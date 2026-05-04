import axios from 'axios';

export async function getRedditVideo(url: string): Promise<string> {
  const res = await axios.get(`${url.replace(/\/$/, '')}.json`);
  const video = res.data?.[0]?.data?.children?.[0]?.data?.secure_media?.reddit_video?.fallback_url;
  if (!video) throw new Error('Video not found or this link does not contain a Reddit-hosted video.');
  return video;
}
