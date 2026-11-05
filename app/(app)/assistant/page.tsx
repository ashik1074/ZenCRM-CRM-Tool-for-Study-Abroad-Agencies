import { requirePagePermission } from "@/server/auth";
import { listConversations } from "@/server/actions/assistant";
import { AssistantPage } from "./assistant-page";

export const metadata = { title: "AI Assistant" };

export default async function Page({ searchParams }: { searchParams: { c?: string } }) {
  await requirePagePermission("assistant");
  const conversations = await listConversations();
  return <AssistantPage conversations={conversations} initial={searchParams.c ?? null} />;
}
