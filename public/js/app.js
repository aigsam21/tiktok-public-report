const reportContainer = document.getElementById('reports');

async function loadReports() {
  reportContainer.innerHTML = `
    <div class="loading">
      데이터를 불러오는 중입니다...
    </div>
  `;

  try {
    const response = await fetch('/api/report-all');

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '오류');
    }

    renderReports(data.reports || []);

  } catch (error) {
    reportContainer.innerHTML = `
      <div class="error">
        오류: ${escapeHtml(error.message)}
      </div>
    `;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getVideoUrls(row) {
  if (Array.isArray(row.videoUrls)) {
    return row.videoUrls;
  }

  if (typeof row.videoUrls === 'string' && row.videoUrls.trim()) {
    return [row.videoUrls];
  }

  if (typeof row.videoUrl === 'string' && row.videoUrl.trim()) {
    return [row.videoUrl];
  }

  return [];
}

function renderReports(reports) {
  reportContainer.innerHTML = reports.map(report => {

    const top10Rows = (report.rows || []).slice(0, 10);

    const metricsHtml = (report.metrics || [])
      .map(metric => `
        <div class="metric">
          <small>${escapeHtml(metric.label)}</small>
          <strong>${escapeHtml(metric.value)}</strong>
        </div>
      `)
      .join('');

    const rowsHtml = top10Rows
      .map((row, index) => {

        const videoUrls = getVideoUrls(row);

        let links = '—';

        if (videoUrls.length) {
          links = videoUrls.map((url, videoIndex) => {
            return `
              <a
                href="${escapeHtml(url)}"
                target="_blank"
                rel="noopener noreferrer"
              >link${videoIndex + 1}</a>
            `;
          }).join(' · ');
        }

        return `
          <tr class="top-10">
            <td>${index + 1}</td>
            <td>${escapeHtml(row.id)}</td>
            <td>${escapeHtml(row.platform || 'TT')}</td>
            <td>${Number(row.posts || 0).toLocaleString()}</td>
            <td>${Number(row.maxViews || 0).toLocaleString()}</td>
            <td>${Number(row.totalViews || 0).toLocaleString()}</td>
            <td>${Number(row.totalSaves || 0).toLocaleString()}</td>
            <td>${escapeHtml(row.avgER || '—')}</td>
            <td class="video-links">${links}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <section class="employee-report">

        <h2 class="employee-name">
          ${escapeHtml(report.employee)}
        </h2>

        <div class="tabs">
          <button class="active">전체</button>
        </div>

        <div class="metrics">
          ${metricsHtml}
        </div>

        <h3>추천 크리에이터</h3>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>아이디</th>
                <th>플랫폼</th>
                <th>게시물</th>
                <th>최고 조회수</th>
                <th>총 조회수</th>
                <th>총 저장</th>
                <th>평균 ER</th>
                <th>Видео</th>
              </tr>
            </thead>

            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

      </section>
    `;
  }).join('');
}

loadReports();