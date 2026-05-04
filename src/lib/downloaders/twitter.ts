import axios from 'axios';
import * as cheerio from 'cheerio';

export async function getTwitterVideo(url: string): Promise<string | null> {
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(res.data);
  const videoUrl = $('meta[property="og:video:url"]').attr('content') || $('video').attr('src');
  return videoUrl ?? null;
}
