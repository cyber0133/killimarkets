import { createFileRoute } from "@tanstack/react-router";
import { EABOTestPage } from "@/components/app/EABOTestPage";

export const Route = createFileRoute("/_authenticated/eabottest")({
  head: () => ({
    meta: [
      { title: "EABO Test · Market Maestro" },
      { name: "description", content: "Paper-trading simulator with live bot logic, charting, accounting and automated strategy decisions." },
    ],
  }),
  component: EABOTestPage,
});
