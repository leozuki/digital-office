/**
 * WordPress Service — Automation for posting content and SEO meta
 * Uses WordPress REST API
 */
const axios = require('axios');

class WordPressService {
  constructor(baseUrl, username, applicationPassword) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.auth = Buffer.from(`${username}:${applicationPassword}`).toString('base64');
  }

  /**
   * Create a new post or update an existing one
   */
  async createPost({ title, content, status = 'publish', categories = [], tags = [], excerpt = '' }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/wp-json/wp/v2/posts`,
        {
          title,
          content,
          status,
          categories,
          tags,
          excerpt,
        },
        {
          headers: {
            Authorization: `Basic ${this.auth}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return {
        id: response.data.id,
        link: response.data.link,
        status: 'success'
      };
    } catch (err) {
      console.error('[WordPress] Failed to create post:', err.response?.data || err.message);
      throw new Error(`WordPress error: ${err.response?.data?.message || err.message}`);
    }
  }

  /**
   * (Placeholder) Analyze post performance for learning
   */
  async getPostMetrics(postId) {
    // In a real scenario, this would connect to Google Search Console or Analytics
    // For now, we simulate "learning" metadata
    return {
      impressions: Math.floor(Math.random() * 100),
      clicks: Math.floor(Math.random() * 10),
      top_keywords: ['digital office', 'ai automation', 'workspace optimization']
    };
  }
}

module.exports = WordPressService;
