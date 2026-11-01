import app from '../server';

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default function handler(req: any, res: any) {
  return app(req, res);
}
