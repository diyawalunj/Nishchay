let cachedApp: any = null;

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default async function handler(req: any, res: any) {
  try {
    if (!cachedApp) {
      const serverModule = await import('../server');
      cachedApp = serverModule.default;
    }
    return cachedApp(req, res);
  } catch (err: any) {
    console.error('SERVER INITIALIZATION OR RUNTIME ERROR:', err);
    return res.status(500).json({
      success: false,
      error: 'Serverless initialization failed: ' + (err?.message || String(err)),
      stack: err?.stack,
      name: err?.name,
    });
  }
}
