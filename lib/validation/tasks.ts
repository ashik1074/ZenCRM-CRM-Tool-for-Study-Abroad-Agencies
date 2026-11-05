import { z } from "zod";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { optDate, optStr, optUuid, reqStr } from "./common";

export const taskSchema = z.object({
  id: optStr(40),
  title: reqStr("Title", 200),
  description: z.string().max(50_000).optional().default(""),
  assignee_id: optUuid,
  priority: z.enum(TASK_PRIORITIES.map((p) => p.value) as [string, ...string[]]).default("medium"),
  status: z.enum(TASK_STATUSES.map((s) => s.value) as [string, ...string[]]).default("todo"),
  due_date: optDate,
  sprint_id: optUuid,
  student_id: optUuid,
  tags: optStr(300),
});
export type TaskInput = z.input<typeof taskSchema>;

export const sprintSchema = z
  .object({
    id: optStr(40),
    name: reqStr("Sprint name", 120),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required"),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date is required"),
    status: z.enum(["planned", "active", "completed"]).default("planned"),
    goal: optStr(500),
  })
  .refine((v) => v.end_date >= v.start_date, { message: "End date must be on or after the start date", path: ["end_date"] });
export type SprintInput = z.input<typeof sprintSchema>;

export const commentSchema = z.object({
  task_id: z.string().uuid(),
  body: z.string().trim().min(1, "Write a comment").max(5000),
  mentions: z.array(z.string().uuid()).max(20).default([]),
});
