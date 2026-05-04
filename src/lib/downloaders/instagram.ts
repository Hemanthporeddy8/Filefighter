import axios from 'axios';

/**
 * Cleans an Instagram URL to its base post/reel format.
 * @param url The original Instagram URL.
 * @returns The cleaned URL.
 */
function cleanInstagramUrl(url: string): string {
  try {
    const urlObject = new URL(url);
    const pathParts = urlObject.pathname.split('/').filter(p => p); // e.g., ['p', 'Cq...'] or ['reel', 'Cq...']

    if ((pathParts[0] === 'p' || pathParts[0] === 'reel') && pathParts[1]) {
      return `https://www.instagram.com/${pathParts[0]}/${pathParts[1]}/`;
    }
    return url; // Return original if format is unexpected
  } catch (e) {
    return url; // Return original on parsing error
  }
}

/**
 * Fetches the video URL from a public Instagram post using the __a=1 JSON endpoint.
 * @param url The public Instagram URL.
 * @returns The direct URL of the video.
 */
export async function getInstagramVideo(url:string): Promise<string> {
  const cleanUrl = cleanInstagramUrl(url);
  const jsonUrl = `${cleanUrl}?__a=1&__d=dis`;

  try {
    const response = await axios.get(jsonUrl, {
      headers: {
        // A realistic user agent is crucial.
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    const json = response.data;
    const videoUrl = json?.items?.[0]?.video_versions?.[0]?.url;

    if (!videoUrl) {
      throw new Error('Video URL not found in API response. The post may be private, deleted, or not a video.');
    }

    return videoUrl;
  } catch (error: any) {
    console.error('Instagram download error:', error.message);
    if (error.response?.status === 404) {
      throw new Error('Post not found. It may be private or deleted.');
    }
    throw new Error('Failed to fetch Instagram video data. The API structure may have changed.');
  }
}
