const express = require('express');
const path = require('path');
const XLSX = require('xlsx');
const dotenv = require('dotenv');

dotenv.config({
  path: path.join(__dirname, 'config', '.env')
});

const { runApify } = require('./apify');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

let cachedReports = null;
let generationPromise = null;

function readExcel(filePath) {
  const workbook = XLSX.readFile(filePath);

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: ''
  });

  console.log(
    'Excel columns:',
    Object.keys(rows[0] || {})
  );

  const input = rows
    .map((row, index) => ({
      no: index + 1,
      id: row['이름'] || '',
      uploadDate: row['업로드날짜'] || '',
      videoUrl: row['TT 업로드링크'] || ''
    }))
    .filter(
      row =>
        typeof row.videoUrl === 'string' &&
        row.videoUrl.trim() !== ''
    );

  console.log(
    `TikTok URLs found: ${input.length}`
  );

  return input;
}

async function generateReports() {
  const dataFolder = path.join(
    __dirname,
    'data'
  );

  const employees = [
    {
      name: '강미경',
      file: path.join(
        dataFolder,
        '강미경.xlsx'
      )
    },
    {
      name: '신유',
      file: path.join(
        dataFolder,
        '신유.xlsx'
      )
    },
    {
      name: '유연식',
      file: path.join(
        dataFolder,
        '유연식.xlsx'
      )
    }
  ];

  const reports = [];

  for (const employee of employees) {
    console.log('');
    console.log(
      `========== ${employee.name} ==========`
    );

    const input = readExcel(employee.file);

    if (!input.length) {
      throw new Error(
        `${employee.name}: TikTok URL을 찾을 수 없습니다.`
      );
    }

    console.log(
      `${employee.name}: Apify 수집 시작`
    );

    const report = await runApify(input);

    reports.push({
      employee: employee.name,
      metrics: report.metrics,
      rows: report.rows
    });

    console.log(
      `${employee.name}: 완료`
    );
  }

  return reports;
}

app.get('/api/report-all', async (req, res) => {
  try {
    if (cachedReports) {
      return res.json({
        reports: cachedReports
      });
    }

    if (!generationPromise) {
      generationPromise = generateReports()
        .then(reports => {
          cachedReports = reports;
          return reports;
        })
        .finally(() => {
          generationPromise = null;
        });
    }

    const reports = await generationPromise;

    res.json({
      reports
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error:
        error.message ||
        '오류가 발생했습니다.'
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok'
  });
});

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `TikTok all report: http://localhost:${PORT}`
    );
  }
);