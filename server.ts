import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import multer from "multer";
import * as XLSX from "xlsx";

dotenv.config();

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Excel Upload API
  app.post("/api/upload", upload.single("file"), (req, res) => {
    try {
      const { uploadKind, year, companyCode } = req.body;
      
      if (!uploadKind) {
        throw new Error("업로드 유형이 없습니다. 월 실적 또는 경영계획을 선택해주세요.");
      }

      console.info("[upload] selected uploadKind:", uploadKind);

      if (!req.file) {
        throw new Error("파일이 없습니다.");
      }

      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      
      const compactRows = rawRows.filter(row => row.some(cell => String(cell ?? '').trim() !== ''));
      if (compactRows.length === 0) {
        throw new Error("빈 파일입니다.");
      }

      // Simplified header extraction for validation
      let headers: string[] = [];
      const headerIndex = compactRows.findIndex(row => row.includes("귀속부서코드") || row.includes("사용처코드"));
      if (headerIndex >= 0) {
        headers = compactRows[headerIndex].map(String);
      } else {
        headers = compactRows[0].map(String);
      }

      console.info("[upload] detected headers:", headers);

      const REQUIRED_MONTHLY_COLUMNS = [
        "귀속부서코드",
        "계정과목코드",
        "계정과목",
        "1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"
      ];

      // validation check
      const normalizeHeader = (h: string) => String(h).replace(/\s+/g, '').replace(/[·・._\-/]/g, '').toLowerCase();
      const normHeaders = headers.map(normalizeHeader);
      
      function validateMonthlyWideFormat(h: string[]) {
        const missing = REQUIRED_MONTHLY_COLUMNS.filter(
          (column) => !normHeaders.some(nh => nh.includes(normalizeHeader(column)))
        );
        if (missing.length > 0) {
          throw new Error(`필수 컬럼이 누락되었습니다: ${missing.join(", ")}`);
        }
      }

      // Mock save handlers
      const saveMonthlyActual = (rows: any) => {
        return { success: true, scenarioType: "actual", message: "실적 데이터 저장 완료" };
      };

      const saveManagementPlan = (rows: any) => {
        return { success: true, scenarioType: "budget", message: "예산 데이터 저장 완료" };
      };

      let scenarioType = "";
      let saveHandlerName = "";
      let result = null;

      // detectUploadType should not determine the save destination
      const detectUploadType = (h: string[]) => {
        return "MONTHLY_WIDE"; // only for format check
      };
      const format = detectUploadType(headers);

      switch (uploadKind) {
        case "monthlyActual":
          scenarioType = "actual";
          saveHandlerName = "saveMonthlyActual";
          validateMonthlyWideFormat(headers);
          result = saveMonthlyActual(compactRows);
          break;
        case "managementPlan":
          scenarioType = "budget";
          saveHandlerName = "saveManagementPlan";
          validateMonthlyWideFormat(headers);
          result = saveManagementPlan(compactRows);
          break;
        default:
          throw new Error("지원하지 않는 업로드 유형입니다.");
      }

      console.info("[upload] target scenarioType:", scenarioType);
      console.info("[upload] target save handler:", saveHandlerName);

      res.json({
        success: true,
        scenarioType,
        message: result.message,
        rows: compactRows // Return parsed rows to frontend to populate table
      });
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  });

  // Korea Exim Bank Exchange Rate API proxy (Daily single rate lookup)
  app.get("/api/exim-daily-rate", async (req, res) => {
    try {
      const year = String(req.query.year || "2026");
      const month = Number(req.query.month || 5);
      
      const apiKey = process.env.EXIM_API_KEY;
      if (!apiKey || apiKey === "MY_EXIM_API_KEY" || apiKey.trim() === "") {
        console.warn("[EXIM API] EXIM_API_KEY is not configured in .env");
        return res.json({
          success: false,
          reason: "API_KEY_MISSING",
          message: "EXIM_API_KEY가 서버 환경변수에 설정되지 않았습니다."
        });
      }

      // Determine starting day. If querying the current year & month, start from today/yesterday.
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const currentDay = now.getDate();

      let startDay = 15; // default mid-month weekday
      if (Number(year) === currentYear && month === currentMonth) {
        startDay = currentDay;
      }

      let foundRate: number | null = null;
      let queriedDate = "";
      
      // Loop backwards up to 10 days to find a valid business day (the API doesn't return data on weekends/holidays)
      for (let i = 0; i < 10; i++) {
        const targetDate = new Date(Number(year), month - 1, startDay - i);
        
        const yFormat = targetDate.getFullYear();
        const mFormat = String(targetDate.getMonth() + 1).padStart(2, "0");
        const dFormat = String(targetDate.getDate()).padStart(2, "0");
        const paramDate = `${yFormat}${mFormat}${dFormat}`;

        const requestUrl = `https://www.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${encodeURIComponent(apiKey)}&searchdate=${paramDate}&data=AP01`;
        
        console.log(`[EXIM API Proxy] Fetching date ${paramDate}...`);
        
        try {
          // Use AbortSignal.timeout to fail fast (e.g., 1.5 seconds) if the server times out
          const response = await fetch(requestUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
              "Accept": "application/json"
            },
            signal: AbortSignal.timeout(1500)
          });

          if (!response.ok) {
            console.error(`[EXIM API Proxy] HTTP status ${response.status} for ${paramDate}`);
            continue;
          }

          const rawData: any = await response.json();
          if (Array.isArray(rawData) && rawData.length > 0) {
            // Find USD record
            const usdRecord = rawData.find((item: any) => item.cur_unit === "USD" || item.cur_unit === "usd");
            if (usdRecord && usdRecord.deal_bas_r) {
              const rateStr = String(usdRecord.deal_bas_r).replace(/,/g, "");
              const rateVal = parseFloat(rateStr);
              if (!isNaN(rateVal) && rateVal > 0) {
                foundRate = rateVal;
                queriedDate = paramDate;
                break; // Found ! Exit fallback loop.
              }
            }
          }
        } catch (err: any) {
          console.error(`[EXIM API Proxy] Network/parsing error for ${paramDate}:`, err);
          
          // Check if this error is a timeout or connection issue. If the host is completely offline or blocking us, 
          // there is no point repeating and waiting 10 more times. Break early to fail-fast.
          const errorMsg = String(err.message || "");
          const isTimeoutOrNetworkFail = 
            err.name === "TimeoutError" || 
            errorMsg.includes("ETIMEDOUT") || 
            errorMsg.includes("fetch failed") || 
            errorMsg.includes("timeout") ||
            err.code === "ETIMEDOUT" ||
            err.code === "ENOTFOUND";

          if (isTimeoutOrNetworkFail) {
            console.warn("[EXIM API Proxy] Unrecoverable/timed out connection detected. Aborting fallback loop to prevent server hanging.");
            break;
          }
        }
      }

      if (foundRate) {
        console.log(`[EXIM API Proxy] Success! Found USD rate: ${foundRate} on ${queriedDate}`);
        return res.json({
          success: true,
          rate: foundRate,
          date: queriedDate,
          source: "koreaexim_api"
        });
      } else {
        return res.json({
          success: false,
          reason: "NO_BUSINESS_DAY_DATA",
          message: `${year}년 ${month}월 기준 유효한 국책은행 실시간 영업일 환율 공시 내역을 찾을 수 없습니다.`
        });
      }
    } catch (outerError: any) {
      console.error("[EXIM API Proxy Outer Error]:", outerError);
      return res.status(500).json({
        success: false,
        reason: "SERVER_ERROR",
        message: outerError.message || "서버 내부 처리 중 환율 API 호출 장애가 발생했습니다."
      });
    }
  });

  // check if EXIM_API_KEY is configured
  app.get("/api/exim-key-status", (req, res) => {
    const apiKey = process.env.EXIM_API_KEY;
    const hasKey = !!(apiKey && apiKey !== "MY_EXIM_API_KEY" && apiKey.trim() !== "");
    res.json({ hasKey });
  });

  // Korea Exim Bank Exchange Rate API (Monthly Average calculation)
  app.get("/api/exim-monthly-average-rate", async (req, res) => {
    try {
      const year = String(req.query.year || "2026");
      const month = Number(req.query.month || 5);
      
      const apiKey = process.env.EXIM_API_KEY;
      if (!apiKey || apiKey === "MY_EXIM_API_KEY" || apiKey.trim() === "") {
        console.warn("[EXIM API] EXIM_API_KEY is not configured in .env");
        return res.json({
          success: false,
          reason: "API_KEY_MISSING",
          message: "EXIM_API_KEY가 서버 환경변수에 설정되지 않았습니다."
        });
      }

      const y = Number(year);
      const m = Number(month);
      const lastDay = new Date(y, m, 0).getDate(); // Get last day of that month

      console.log(`[EXIM API Proxy Monthly] Querying average rate for ${y}-${m} (Days: 1 to ${lastDay})`);

      // Prepare promise array for parallel resolution to prevent slow waterfall queries
      const fetchPromises = Array.from({ length: lastDay }, (_, index) => {
        const day = index + 1;
        const paramDate = `${y}${String(m).padStart(2, "0")}${String(day).padStart(2, "0")}`;
        const requestUrl = `https://www.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${encodeURIComponent(apiKey)}&searchdate=${paramDate}&data=AP01`;

        return (async () => {
          try {
            const response = await fetch(requestUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
                "Accept": "application/json"
              },
              signal: AbortSignal.timeout(2000)
            });

            if (!response.ok) return null;
            const rawData: any = await response.json();
            if (Array.isArray(rawData) && rawData.length > 0) {
              const usdRecord = rawData.find((item: any) => item.cur_unit === "USD" || item.cur_unit === "usd");
              if (usdRecord && usdRecord.deal_bas_r) {
                const rateStr = String(usdRecord.deal_bas_r).replace(/,/g, "");
                const rateVal = parseFloat(rateStr);
                if (!isNaN(rateVal) && rateVal > 0) {
                  return rateVal;
                }
              }
            }
          } catch (e) {
            // Soft ignore single external transient failures/weekend errors to proceed
          }
          return null;
        })();
      });

      const results = await Promise.all(fetchPromises);
      const validRates = results.filter((rate): rate is number => rate !== null);
      const businessDayCount = validRates.length;

      if (businessDayCount < 10) {
        console.warn(`[EXIM API Proxy Monthly] Insufficient business days fetched: ${businessDayCount}/10 required.`);
        return res.json({
          success: false,
          reason: "INSUFFICIENT_DATA",
          message: `공시된 영업일 데이터가 부족하여 신뢰할 수 있는 월평균 환율을 구하지 못했습니다. (조회 성공: ${businessDayCount}일, 최소 필요: 10일)`
        });
      }

      const sum = validRates.reduce((acc, val) => acc + val, 0);
      const averageRate = Math.round((sum / businessDayCount) * 10) / 10; // Round to 1 decimal place

      console.log(`[EXIM API Proxy Monthly] Success. Average: ${averageRate} over ${businessDayCount} business days.`);
      return res.json({
        success: true,
        year,
        month: m,
        currency: "USD",
        averageRate,
        businessDayCount,
        source: "koreaexim_monthly_average"
      });
    } catch (outerError: any) {
      console.error("[EXIM API Proxy Monthly Outer Error]:", outerError);
      return res.status(500).json({
        success: false,
        reason: "SERVER_ERROR",
        message: outerError.message || "서버 내부 처리 중 월평균 환율 계산 장애가 발생했습니다."
      });
    }
  });

  // API routes
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, text } = req.body;

    // For demo purposes, we'll log the email. 
    // In a real app, you'd use a real SMTP transport.
    console.log(`Sending email to ${to}...`);
    console.log(`Subject: ${subject}`);
    console.log(`Content: ${text}`);

    try {
      // Mocking successful send
      // If you have real credentials, uncomment and configure:
      /*
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
      await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, text });
      */
      
      res.json({ success: true, message: "Email sent (mocked)" });
    } catch (error) {
      console.error("Email error:", error);
      res.status(500).json({ success: false, error: "Failed to send email" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
