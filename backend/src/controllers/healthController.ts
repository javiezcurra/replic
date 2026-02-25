import { Request, Response } from 'express'

export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
    version: process.env.npm_package_version ?? '0.1.0',
  })
}
