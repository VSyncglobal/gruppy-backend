import { Request, Response, NextFunction } from "express";
import { z, ZodObject } from "zod"; // ✨ FIX: Import ZodObject directly for clarity

/**
 * Middleware to validate request body, params, or query against a Zod schema.
 * @param schema The Zod schema to validate against.
 */
export const validate = (schema: ZodObject<any>) => // ✨ FIX: Use the 'ZodObject' type
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      // If validation fails, Zod provides a detailed error object
      return res.status(400).json(error);
    }
};
