"use client";

import { HelpCircle } from "lucide-react";
import type { DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

// Both the mobile top-bar nav and the desktop sidebar render the same
// data-tour targets (only one is visible at a time via CSS). Resolve to
// whichever copy is actually on screen when a step highlights, not just
// the first match in DOM order.
function visibleElement(selector: string): Element | undefined {
  const candidates = document.querySelectorAll(selector);
  for (const el of Array.from(candidates)) {
    if ((el as HTMLElement).offsetParent !== null) return el;
  }
  return candidates[0];
}

const STEPS: DriveStep[] = [
  {
    element: () => visibleElement('[data-tour="brand"]') as Element,
    popover: {
      title: "StudyBeacon",
      description: "This logo always brings you back to the dashboard.",
    },
  },
  {
    element: () => visibleElement('[data-tour="nav-sessions"]') as Element,
    popover: {
      title: "Sessions",
      description: "Browse every session you've processed here.",
    },
  },
  {
    element: () => visibleElement('[data-tour="new-session"]') as Element,
    popover: {
      title: "New Session",
      description: "Start here to upload a recording. Processing isn't wired up yet, but this is where it'll begin.",
    },
  },
  {
    element: () => visibleElement('[data-tour="sessions-widget"]') as Element,
    popover: {
      title: "Sessions at a glance",
      description: "See how many sessions you've processed, and jump straight to the list.",
    },
  },
];

export default function TutorialButton() {
  async function startTour() {
    const { driver } = await import("driver.js");
    driver({
      showProgress: true,
      steps: STEPS,
    }).drive();
  }

  return (
    <button
      onClick={startTour}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-accent)] transition-colors shrink-0"
    >
      <HelpCircle className="w-4 h-4" />
      Tutorial
    </button>
  );
}
