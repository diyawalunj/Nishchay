import app from '../server';

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('Unhandled serverless error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: err?.message || String(err),
        stack: err?.stack,
      });
    }
  }
}
