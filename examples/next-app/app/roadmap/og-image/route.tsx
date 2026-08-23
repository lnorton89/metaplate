import { og } from "../../../lib/og";
import { copy } from "../page";

export const dynamic = "force-static";
export const GET = og.handler(copy);
