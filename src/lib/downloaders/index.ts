import { getInstagramVideo } from './instagram';
import { getFacebookVideo } from './facebook';
import { getTwitterVideo } from './twitter';
import { getRedditVideo } from './reddit';

export async function getDownloadLink(platform: string, url: string): Promise<string | null> {
  switch (platform) {
    case 'instagram': return await getInstagramVideo(url);
    case 'facebook': return await getFacebookVideo(url);
    case 'twitter': return await getTwitterVideo(url);
    case 'reddit': return await getRedditVideo(url);
    default: throw new Error('Unsupported platform');
  }
}
