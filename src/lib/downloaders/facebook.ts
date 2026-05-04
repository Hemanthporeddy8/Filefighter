import axios from 'axios';
import * as cheerio from 'cheerio';

export async function getFacebookVideo(url: string): Promise<string> {
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(res.data);
  const videoUrl = $('meta[property="og:video"]').attr('content');
  if (!videoUrl) throw new Error('Video not found or it might be private.');
  return videoUrl;
}
