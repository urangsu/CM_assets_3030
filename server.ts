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
