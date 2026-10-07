const { ApifyClient } = require('apify-client');

async function runApify(input) {
  if (!process.env.APIFY_API_TOKEN) {
    throw new Error('APIFY_API_TOKEN이 설정되지 않았습니다.');
  }

  const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN
  });

  const actorId =
    process.env.APIFY_ACTOR_ID || 'poidata/tiktok-scraper';

  const urls = input
    .map(row => row.videoUrl)
    .filter(url => typeof url === 'string' && url.trim())
    .map(url => url.trim());

  if (!urls.length) {
    throw new Error('Excel에서 TikTok Video URL을 찾을 수 없습니다.');
  }

  console.log(
    `Apify: ${urls.length}개 TikTok URL 수집 시작`
  );

  const run = await client.actor(actorId).call({
    postURLs: urls
  });

  console.log(`Apify 실행 완료: ${run.id}`);

  const { items } =
    await client.dataset(run.defaultDatasetId).listItems();

  if (!items || !items.length) {
    throw new Error(
      'Apify에서 결과 데이터를 받지 못했습니다.'
    );
  }

  console.log(`Apify 결과: ${items.length}개`);

  const results = items.map(item => {
    const views = Number(
      item.playCount ??
      item.views ??
      item.stats?.playCount ??
      0
    );

    const likes = Number(
      item.diggCount ??
      item.likes ??
      item.stats?.diggCount ??
      0
    );

    const comments = Number(
      item.commentCount ??
      item.comments ??
      item.stats?.commentCount ??
      0
    );

    const shares = Number(
      item.shareCount ??
      item.shares ??
      item.stats?.shareCount ??
      0
    );

    const saves = Number(
      item.collectCount ??
      item.saves ??
      item.stats?.collectCount ??
      0
    );

    const author =
      item.authorMeta?.name ||
      item.authorMeta?.nickName ||
      item.author?.uniqueId ||
      item.author ||
      '';

    const videoUrl =
      item.webVideoUrl ||
      item.videoUrl ||
      item.url ||
      '';

    const createTime =
      item.createTimeISO ||
      item.createTime ||
      item.createTimeIso ||
      '';

    return {
      videoUrl,
      id: author,
      views,
      likes,
      comments,
      shares,
      saves,
      createTime
    };
  });

  const enriched = input.map(row => {
    const inputUrl = (row.videoUrl || '').trim();

    const found = results.find(result => {
      if (!result.videoUrl || !inputUrl) {
        return false;
      }

      const resultUrl =
        result.videoUrl.trim().replace(/\/$/, '');

      const originalUrl =
        inputUrl.replace(/\/$/, '');

      return (
        resultUrl === originalUrl ||
        resultUrl.includes(originalUrl) ||
        originalUrl.includes(resultUrl)
      );
    });

    return {
      no: row.no,
      id: row.id || found?.id || '',
      videoUrl: inputUrl,
      views: found?.views || 0,
      likes: found?.likes || 0,
      comments: found?.comments || 0,
      shares: found?.shares || 0,
      saves: found?.saves || 0,
      createTime: found?.createTime || ''
    };
  });

  return buildReport(enriched);
}

function buildReport(videos) {
  const creators = {};

  for (const video of videos) {
    const id = video.id || 'Unknown';

    if (!creators[id]) {
      creators[id] = {
        id,
        posts: 0,
        totalViews: 0,
        totalSaves: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        maxViews: 0,
        videos: []
      };
    }

    const creator = creators[id];

    creator.posts += 1;
    creator.totalViews += video.views;
    creator.totalSaves += video.saves;
    creator.totalLikes += video.likes;
    creator.totalComments += video.comments;
    creator.totalShares += video.shares;
    creator.maxViews = Math.max(
      creator.maxViews,
      video.views
    );

    creator.videos.push(video);
  }

  const rows = Object.values(creators).map(creator => {
    const erValues = creator.videos.map(video => {
      if (!video.views) {
        return 0;
      }

      return (
        (
          video.likes +
          video.comments +
          video.shares +
          video.saves
        ) /
        video.views
      ) * 100;
    });

    const avgER = erValues.length
      ? erValues.reduce((a, b) => a + b, 0) /
        erValues.length
      : 0;

    const recommended =
      creator.maxViews >= 30000 ||
      creator.totalSaves >= 300;

    const videoUrls = [
      ...new Set(
        creator.videos
          .map(video => video.videoUrl)
          .filter(
            url =>
              typeof url === 'string' &&
              url.trim()
          )
      )
    ];

    return {
      id: creator.id,
      platform: 'TT',
      posts: creator.posts,
      maxViews: creator.maxViews,
      totalViews: creator.totalViews,
      totalSaves: creator.totalSaves,
      avgER: avgER.toFixed(2) + '%',
      recommended,
      videoUrls
    };
  });

  rows.sort(
    (a, b) => b.maxViews - a.maxViews
  );

  const totalViews = videos.reduce(
    (sum, video) => sum + video.views,
    0
  );

  const totalSaves = videos.reduce(
    (sum, video) => sum + video.saves,
    0
  );

  const erValues = videos
    .filter(video => video.views > 0)
    .map(
      video =>
        (
          (
            video.likes +
            video.comments +
            video.shares +
            video.saves
          ) /
          video.views
        ) * 100
    )
    .sort((a, b) => a - b);

  const medianER = erValues.length
    ? erValues[Math.floor(erValues.length / 2)]
    : 0;

  const topVideo = videos.reduce(
    (best, video) =>
      video.views > (best?.views || 0)
        ? video
        : best,
    null
  );

  return {
    metrics: [
      {
        label: '게시물',
        value: videos.length.toLocaleString()
      },
      {
        label: '총 조회수',
        value: totalViews.toLocaleString()
      },
      {
        label: '총 저장수',
        value: totalSaves.toLocaleString()
      },
      {
        label: '중앙 ER',
        value: medianER.toFixed(2) + '%'
      },
      {
        label: '최고 조회 영상',
        value: topVideo
          ? topVideo.views.toLocaleString()
          : '0'
      }
    ],
    rows
  };
}

module.exports = {
  runApify
};