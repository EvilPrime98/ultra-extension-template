import { Handler } from "./core.types";

export const logger: Handler = async (
    c, 
    next
) => {
    const start = performance.now();
    const res = await next();
    const ms = Math.round(performance.now() - start);
    console.log(`[receptor] ${c.req.method} ${c.req.path} -> ${res.status} (${ms}ms)`);
    return res;
};
