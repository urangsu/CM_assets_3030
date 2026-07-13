import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import multer from "multer";
import * as XLSX from "xlsx";
import { ProxyAgent, fetch as undiciFetch } from "undici";

dotenv.config();

// Private IP / localhost / link-local checking helper
function isPrivateOrLocalhost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  
  if (
    normalized === "localhost" ||
    normalized === "localhost.localdomain" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "0.0.0.0"
  ) {
    return true;
  }

  const ipv4Regex = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
  const match = normalized.match(ipv4Regex);
  if (match) {
    const octet1 = parseInt(match[1], 10);
    const octet2 = parseInt(match[2], 10);
    if (octet1 === 10) return true;
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return true;
    if (octet1 === 192 && octet2 === 168) return true;
    if (octet1 === 169 && octet2 === 254) return true;
    if (octet1 === 127) return true;
  }

  if (
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc00:") ||
    normalized.startsWith("fd00:")
  ) {
    return true;
  }

  return false;
}

// Proxy host validator
function validateProxyHost(host: string): boolean {
  if (!host) return false;
  const normalized = host.trim().toLowerCase();

  // Block private and localhost
  if (isPrivateOrLocalhost(normalized)) {
    return false;
  }

  // Allowlist check (allow server env vars or a static list of safe proxies)
  const allowedList = process.env.ALLOWED_PROXY_HOSTS
    ? process.env.ALLOWED_PROXY_HOSTS.split(",").map(h => h.trim().toLowerCase())
    : ["proxy.posco.com", "proxy.poscohycm.com", "proxy.posco-hycm.com", "proxy.company.com"];

  return allowedList.includes(normalized);
}

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Excel Upload API - Server Persistence is Not Implemented
  app.post("/api/upload", upload.single("file"), (req, res) => {
    return res.status(501).json({
      success: false,
      reason: "SERVER_PERSISTENCE_NOT_IMPLEMENTED",
      message: "서버 업로드 저장 기능이 구현되지 않았습니다. 클라이언트 업로드 화면을 이용해주세요."
    });
  });

  // Korea Exim Bank Exchange Rate API proxy (Daily single rate lookup)
  app.get("/api/exim-daily-rate", async (req, res) => {
    const apiKeyRaw = process.env.EXIM_API_KEY;
    const apiKey = String(apiKeyRaw || "").trim();
    try {
      const year = String(req.query.year || "2026");
      const month = Number(req.query.month || 5);
      
      if (!apiKey || apiKey === "MY_EXIM_API_KEY" || apiKey === "") {
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

        const requestUrl = `https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${encodeURIComponent(apiKey)}&searchdate=${paramDate}&data=AP01`;
        
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
          const maskedErr = safe_error_message(err, apiKey);
          console.error(`[EXIM API Proxy] Network/parsing error for ${paramDate}: ${maskedErr}`);
          
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
      const maskedOuterErr = safe_error_message(outerError, apiKey);
      console.error("[EXIM API Proxy Outer Error]:", maskedOuterErr);
      return res.status(500).json({
        success: false,
        reason: "SERVER_ERROR",
        message: outerError.message ? safe_error_message(outerError.message, apiKey) : "서버 내부 처리 중 환율 API 호출 장애가 발생했습니다."
      });
    }
  });

  // Year-range normalizing functions for exim proxy
  function normalize_year(year: any): number {
    const y = parseInt(String(year || "").trim(), 10);
    if (isNaN(y)) return 2026;
    if (y < 100) {
      return 2000 + y;
    }
    return y;
  }

  function make_searchdate(year: any, month: any, day: any): string {
    const y = normalize_year(year);
    const m = parseInt(String(month || "").trim(), 10);
    const d = parseInt(String(day || "").trim(), 10);
    return `${y.toString().padStart(4, "0")}${m.toString().padStart(2, "0")}${d.toString().padStart(2, "0")}`;
  }

  function maskApiKey(key: string): string {
    const cleanKey = String(key || "").trim();
    if (!cleanKey) return "none";
    if (cleanKey.length <= 8) return "****";
    return `${cleanKey.substring(0, 4)}****${cleanKey.substring(cleanKey.length - 4)}`;
  }

  function safe_error_message(error: any, authkey: string): string {
    if (!error) return "";
    let msg = typeof error === "object" ? (error.stack || error.message || String(error)) : String(error);
    if (authkey && authkey.trim() !== "") {
      const escapedKey = authkey.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escapedKey, 'g');
      msg = msg.replace(regex, maskApiKey(authkey));
    }
    return msg;
  }

  // check if EXIM_API_KEY is configured
  app.get("/api/exim-key-status", (req, res) => {
    const apiKey = process.env.EXIM_API_KEY;
    const hasKey = !!(apiKey && apiKey !== "MY_EXIM_API_KEY" && apiKey.trim() !== "");
    const masked = apiKey ? maskApiKey(apiKey) : "none";
    res.json({ hasKey, masked });
  });

  // Korea Exim Bank Exchange Rate API (Monthly Average calculation)
  app.get("/api/exim-monthly-average-rate", async (req, res) => {
    interface FetchDetail {
      date: string;
      status: "success" | "empty" | "http_error" | "parse_error" | "no_usd" | "invalid_key" | "network_error";
      rate: number;
      message: string;
    }

    let apiKey = "";
    try {
      const year = String(req.query.year || "2026");
      const month = Number(req.query.month || 5);
      
      const useProxy = req.query.useProxy;
      const proxyHost = req.query.proxyHost;
      const proxyPort = req.query.proxyPort;
      const proxyUser = req.query.proxyUser;
      const proxyPass = req.query.proxyPass;

      // Create local dispatcher per-request rather than polluting process.env
      let dispatcher: ProxyAgent | undefined = undefined;
      if (useProxy === "true" && proxyHost && proxyPort) {
        const hostStr = String(proxyHost);
        if (!validateProxyHost(hostStr)) {
          console.warn(`[EXIM API Proxy] Blocked unallowed or private/local proxy host: ${hostStr}`);
          return res.status(400).json({
            success: false,
            reason: "PROXY_HOST_NOT_ALLOWED",
            message: "허용되지 않은 프록시 호스트이거나 사설 IP/Localhost는 프록시로 사용할 수 없습니다."
          });
        }
        const authPart = (proxyUser && proxyPass) ? `${proxyUser}:${proxyPass}@` : "";
        const proxyUrl = `http://${authPart}${proxyHost}:${proxyPort}`;
        dispatcher = new ProxyAgent({ uri: proxyUrl });
        console.log(`[EXIM API Proxy] Using ProxyAgent for host: ${proxyHost}:${proxyPort} (credentials masked)`);
      }

      const apiKeyRaw = process.env.EXIM_API_KEY;
      apiKey = String(apiKeyRaw || "").trim();

      // Check key validation before calling API
      if (!apiKey || apiKey === "MY_EXIM_API_KEY" || apiKey === "") {
        console.warn("[EXIM API] EXIM_API_KEY is missing or invalid in server environment.");
        return res.json({
          success: false,
          status: "invalid_key",
          reason: "API_KEY_MISSING",
          message: "한국수출입은행 API 인증키가 설정되지 않았거나 올바르지 않습니다.",
          requestedDays: 0,
          successCount: 0,
          emptyCount: 0,
          apiErrorCount: 0,
          networkErrorCount: 0,
          averageRate: 0,
          policy: "key_missing",
          majorFailureReason: "한국수출입은행 API 인증키(EXIM_API_KEY)가 비어 있거나 올바르지 않습니다.",
          details: []
        });
      }

      const y = normalize_year(year);
      const m = Number(month);
      const lastDay = new Date(y, m, 0).getDate(); // Get last day of that month

      console.log(`[EXIM API Proxy Monthly] Querying average rate for ${y}-${m}`);

      const startTime = Date.now();
      const TOTAL_TIMEOUT_MS = 15000; // 15 seconds total request timeout limit

      // P0. Network Connection pre-check (Probe) on the 1st of the month
      const probeDate = make_searchdate(y, m, 1);
      const probeUrl = `https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${encodeURIComponent(apiKey)}&searchdate=${probeDate}&data=AP01`;

      let probeOk = false;
      let probeStatus: "success" | "empty" | "http_error" | "parse_error" | "invalid_key" | "network_error" = "success";
      let probeMsg = "";

      try {
        console.log(`[EXIM API Proxy] Performing single probe connection test on ${probeDate}...`);
        const probeResponse = await undiciFetch(probeUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
            "Accept": "application/json"
          },
          signal: AbortSignal.timeout(3000), // Lower connection/response probe timeout to 3s
          dispatcher
        });

        if (!probeResponse.ok) {
          probeStatus = "http_error";
          probeMsg = `HTTP 에러 발생 (Status: ${probeResponse.status})`;
        } else {
          let probeData: any;
          try {
            probeData = await probeResponse.json();
            
            if (probeData && probeData.result !== undefined && probeData.result !== 1) {
              probeStatus = "invalid_key";
              probeMsg = `API 인증 실패 (인증오류코드: ${probeData.result}, 메세지: ${probeData.message || "인증 실패"})`;
            } else {
              probeOk = true; // API connection & payload parser succeeded
              probeStatus = Array.isArray(probeData) && probeData.length === 0 ? "empty" : "success";
              probeMsg = "연결 성공";
            }
          } catch (jsonErr) {
            probeStatus = "parse_error";
            probeMsg = "JSON 응답 파싱 실패";
          }
        }
      } catch (probeErr: any) {
        probeStatus = "network_error";
        probeMsg = `네트워크/연결 시간 초과 발생: ${probeErr.message || "Unknown"}`;
      }

      // If probe connection test failed, abort entire monthly queries immediately!
      if (!probeOk) {
        console.warn(`[EXIM API Proxy] Connection probe check failed: ${probeMsg}. Stopping query loop.`);

        let majorFailureReason = "";
        let finalStatus: "network_error" | "invalid_key" | "http_error" = "network_error";

        if (probeStatus === "network_error") {
          majorFailureReason = "회사망, 프록시, 방화벽, SSL 인증서 또는 외부 API 서버 응답 지연으로 인해 한국수출입은행 API에 연결하지 못했습니다.";
          finalStatus = "network_error";
        } else if (probeStatus === "invalid_key") {
          majorFailureReason = `API 인증키가 올바르지 않습니다. (${probeMsg})`;
          finalStatus = "invalid_key";
        } else {
          majorFailureReason = `한국수출입은행 API 서버 응답 지연 또는 HTTP 통신 실패. (${probeMsg})`;
          finalStatus = "http_error";
        }

        return res.json({
          success: false,
          status: finalStatus,
          year: y,
          month: m,
          currency: "USD",
          requestedDays: 0,    // 0 days queried, because probe interrupted before querying days
          successCount: 0,
          emptyCount: 0,
          apiErrorCount: (probeStatus === "invalid_key" || probeStatus === "http_error" || probeStatus === "parse_error") ? 1 : 0,
          networkErrorCount: (probeStatus === "network_error") ? 1 : 0,
          averageRate: 0,
          policy: "network_fail",
          majorFailureReason,
          exampleRequestDate: probeDate,
          expectedFormat: "YYYYMMDD",
          details: [
            {
              date: probeDate,
              status: probeStatus,
              rate: 0,
              message: `[사전 연결 테스트 실패] ${probeMsg}`
            }
          ]
        });
      }

      // Parallel waterfall is disabled; we optimize for sequential queries skipping weekends & consecutive failure checks
      console.log(`[EXIM API Proxy] Connection probe succeeded. Fetching monthly weekday data with optimized sequential query loop...`);
      const weekdayResults: FetchDetail[] = [];
      let consecutiveFailures = 0;
      let successDays = 0;

      // Generate all weekdays for target month
      const weekdaysToQuery: { day: number, dateStr: string }[] = [];
      for (let day = 1; day <= lastDay; day++) {
        const dateObj = new Date(y, m - 1, day);
        const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 6 is Saturday
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          weekdaysToQuery.push({ day, dateStr: make_searchdate(y, m, day) });
        }
      }

      // Query weekdays sequentially, breaks immediately on 2 consecutive failures or if total timeout is exceeded
      for (const item of weekdaysToQuery) {
        if (consecutiveFailures >= 2) {
          console.warn(`[EXIM API Proxy] 2 consecutive failures detected. Safely terminating query loop for ${y}-${m} at ${item.dateStr}`);
          break;
        }

        if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
          console.warn(`[EXIM API Proxy] Total request timeout limit of ${TOTAL_TIMEOUT_MS}ms exceeded. Aborting.`);
          break;
        }

        const requestUrl = `https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${encodeURIComponent(apiKey)}&searchdate=${item.dateStr}&data=AP01`;

        try {
          const response = await undiciFetch(requestUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
              "Accept": "application/json"
            },
            signal: AbortSignal.timeout(4000), // Lower response wait to 4s
            dispatcher
          });

          if (!response.ok) {
            consecutiveFailures++;
            weekdayResults.push({
              date: item.dateStr,
              status: "http_error",
              rate: 0,
              message: `HTTP 에러 발생 (Status: ${response.status})`
            });
            continue;
          }

          let rawData: any;
          try {
            rawData = await response.json();
          } catch (jsonErr) {
            consecutiveFailures++;
            weekdayResults.push({
              date: item.dateStr,
              status: "parse_error",
              rate: 0,
              message: "JSON 응답 파싱 실패"
            });
            continue;
          }

          if (rawData && rawData.result !== undefined && rawData.result !== 1) {
            consecutiveFailures++;
            weekdayResults.push({
              date: item.dateStr,
              status: "invalid_key",
              rate: 0,
              message: `API 인증 실패 (인증오류코드: ${rawData.result}, 메세지: ${rawData.message || "인증 실패"})`
            });
            continue;
          }

          if (Array.isArray(rawData)) {
            if (rawData.length === 0) {
              consecutiveFailures = 0; // successfully connected and parsed empty response (e.g. holiday weekday)
              weekdayResults.push({
                date: item.dateStr,
                status: "empty",
                rate: 0,
                message: "데이터 미공시 영업일 외 (공휴일 등)"
              });
            } else {
              const usdRecord = rawData.find((record: any) => record.cur_unit === "USD" || record.cur_unit === "usd");
              if (usdRecord && usdRecord.deal_bas_r) {
                const rateStr = String(usdRecord.deal_bas_r).replace(/,/g, "");
                const rateVal = parseFloat(rateStr);
                if (!isNaN(rateVal) && rateVal > 0) {
                  consecutiveFailures = 0;
                  successDays++;
                  weekdayResults.push({
                    date: item.dateStr,
                    status: "success",
                    rate: rateVal,
                    message: "조회 성공"
                  });
                } else {
                  consecutiveFailures++;
                  weekdayResults.push({
                    date: item.dateStr,
                    status: "no_usd",
                    rate: 0,
                    message: "USD 환율 파싱 실패"
                  });
                }
              } else {
                consecutiveFailures++;
                weekdayResults.push({
                  date: item.dateStr,
                  status: "no_usd",
                  rate: 0,
                  message: "공시 목록 내 USD 통화 정보 없음"
                });
              }
            }
          } else {
            consecutiveFailures++;
            weekdayResults.push({
              date: item.dateStr,
              status: "parse_error",
              rate: 0,
              message: "알 수 없는 응답 구분"
            });
          }

        } catch (err: any) {
          consecutiveFailures++;
          weekdayResults.push({
            date: item.dateStr,
            status: "network_error",
            rate: 0,
            message: `네트워크/연결 시간 초과 발생: ${err.message || "Unknown"}`
          });
        }
      }

      // Backfill results with weekend days to provide a full monthly calendar dataset
      const finalMonthlyResults: FetchDetail[] = [];
      let successCount = 0;
      let emptyCount = 0;
      let weekendCount = 0;
      let apiErrorCount = 0;
      let networkErrorCount = 0;
      const validRates: number[] = [];

      for (let day = 1; day <= lastDay; day++) {
        const dateStr = make_searchdate(y, m, day);
        const weekdayRes = weekdayResults.find(r => r.date === dateStr);
        if (weekdayRes) {
          finalMonthlyResults.push(weekdayRes);
          if (weekdayRes.status === "success") {
            successCount++;
            validRates.push(weekdayRes.rate);
          } else if (weekdayRes.status === "empty" || weekdayRes.status === "no_usd") {
            emptyCount++;
          } else if (weekdayRes.status === "invalid_key" || weekdayRes.status === "http_error" || weekdayRes.status === "parse_error") {
            apiErrorCount++;
          } else if (weekdayRes.status === "network_error") {
            networkErrorCount++;
          }
        } else {
          // Weekend backfill
          finalMonthlyResults.push({
            date: dateStr,
            status: "empty",
            rate: 0,
            message: "데이터 미공시 영업일 외 (주말/공휴일 등)"
          });
          weekendCount++;
        }
      }

      // Flexible rate threshold policies based on historical vs current month targets
      const now = new Date();
      const currentY = now.getFullYear();
      const currentM = now.getMonth() + 1;

      const isCurrentOrFutureMonth = (y > currentY) || (y === currentY && m >= currentM);

      let averageRate = 0;
      let policy = "";
      let canCalculate = false;

      if (!isCurrentOrFutureMonth) {
        // Historical Month: requires at least 10 business days
        if (successCount >= 10) {
          canCalculate = true;
          policy = "past_month_confirmed";
        } else {
          policy = "past_month_insufficient";
        }
      } else {
        // Current/Future Month
        if (successCount >= 10) {
          canCalculate = true;
          policy = "current_month_confirmed";
        } else if (successCount >= 3) {
          canCalculate = true;
          policy = "current_month_temp_average";
        } else {
          policy = "current_month_insufficient";
        }
      }

      if (canCalculate && validRates.length > 0) {
        const sum = validRates.reduce((acc, val) => acc + val, 0);
        averageRate = Math.round((sum / validRates.length) * 10) / 10;
      }

      // Diagnose top failure reason when successCount is 0
      let majorFailureReason = "";
      if (successCount === 0) {
        const keyErr = finalMonthlyResults.find(r => r.status === "invalid_key");
        if (keyErr) {
          majorFailureReason = `${keyErr.message} (인증키 형식을 점검해 주십시오.)`;
        } else if (apiErrorCount > 0) {
          const firstErr = finalMonthlyResults.find(r => r.status === "http_error" || r.status === "parse_error");
          majorFailureReason = firstErr ? `${firstErr.message} (상태: ${firstErr.status})` : "API 호출 서버 에러";
        } else if (networkErrorCount > 0) {
          majorFailureReason = "회사망, 프록시, 방화벽, SSL 인증서 또는 외부 API 서버 응답 지연으로 인해 한국수출입은행 API에 연결하지 못했습니다.";
        } else {
          majorFailureReason = "조회 대상 기간의 일자가 모두 공휴일/미공시 상태입니다.";
        }
      }

       return res.json({
        success: canCalculate && successCount > 0,
        status: canCalculate && successCount > 0 ? "success" : (apiErrorCount > 0 ? "http_error" : "empty"),
        year: y,
        month: m,
        currency: "USD",
        calendarDays: lastDay,
        requestedDays: weekdaysToQuery.length, // Only queried weekdays
        successCount,
        emptyCount,
        weekendCount,
        apiErrorCount,
        networkErrorCount,
        averageRate,
        policy,
        majorFailureReason,
        exampleRequestDate: make_searchdate(y, m, 1),
        expectedFormat: "YYYYMMDD",
        details: finalMonthlyResults
      });

    } catch (outerError: any) {
      const maskedOuterErr = safe_error_message(outerError, apiKey);
      console.error("[EXIM API Proxy Monthly Outer Error]:", maskedOuterErr);
      return res.status(500).json({
        success: false,
        status: "parse_error",
        reason: "SERVER_ERROR",
        message: outerError.message ? safe_error_message(outerError.message, apiKey) : "서버 내부 처리 중 월평균 환율 계산 장애가 발생했습니다.",
        requestedDays: 0,
        successCount: 0,
        emptyCount: 0,
        apiErrorCount: 1,
        networkErrorCount: 0,
        averageRate: 0,
        policy: "error",
        majorFailureReason: outerError.message ? safe_error_message(outerError.message, apiKey) : "서버 예외 오류",
        details: []
      });
    }
  });

  // API routes
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, text } = req.body;

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const emailHost = process.env.EMAIL_HOST;
    const emailPort = process.env.EMAIL_PORT;

    if (!emailUser || !emailPass) {
      console.warn("[Email API] SMTP transport is not configured (EMAIL_USER/EMAIL_PASS missing)");
      return res.status(400).json({
        success: false,
        reason: "EMAIL_TRANSPORT_NOT_CONFIGURED",
        message: "SMTP 메일 전송이 설정되지 않았습니다. 환경변수 EMAIL_USER, EMAIL_PASS를 점검해주세요."
      });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: emailHost || "smtp.gmail.com",
        port: Number(emailPort || 587),
        secure: Number(emailPort) === 465,
        auth: {
          user: emailUser,
          pass: emailPass
        }
      });

      const info = await transporter.sendMail({
        from: emailUser,
        to,
        subject,
        text
      });

      console.info(`[Email API] Email sent successfully. MessageId: ${info.messageId}`);
      return res.json({ 
        success: true, 
        message: "Email sent successfully", 
        messageId: info.messageId 
      });
    } catch (error: any) {
      console.error("[Email API] Email send error:", error);
      return res.status(500).json({ 
        success: false, 
        reason: "EMAIL_SEND_FAILED",
        error: error.message || "Failed to send email" 
      });
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
