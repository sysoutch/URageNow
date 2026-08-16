import type { AutomationPreset } from "./types.js";
import { defaultJokesFileName } from "./defaults.js";

export const automationPresets: AutomationPreset[] = [
  {
    id: "unity-publisher-gift",
    scope: "schedule",
    name: "Unity Publisher Gift",
    description: "Check Unity Publisher of the Week and post the active free gift when one is live.",
    scheduleDefaults: {
      triggerMode: "cron",
      cron: "0 12 * * *",
      intervalValue: 1,
      intervalUnit: "days",
      repeatCount: 1,
      repeatDelaySeconds: 0,
      action: {
        source: "unity-publisher-gift",
        template: "",
        prompt: "",
        jokesFile: defaultJokesFileName
      }
    }
  },
  {
    id: "daily-joke-file",
    scope: "schedule",
    name: "Daily Joke From File",
    description: "Post a random joke from jokes.txt every day.",
    scheduleDefaults: {
      triggerMode: "cron",
      cron: "0 9 * * *",
      intervalValue: 1,
      intervalUnit: "days",
      repeatCount: 1,
      repeatDelaySeconds: 0,
      action: {
        source: "jokes-file",
        template: "",
        prompt: "",
        jokesFile: defaultJokesFileName
      }
    }
  },
  {
    id: "daily-joke-ollama",
    scope: "schedule",
    name: "Daily Joke From LazyDev",
    description: "Ask LazyDev for one short clean joke every day.",
    scheduleDefaults: {
      triggerMode: "cron",
      cron: "0 9 * * *",
      intervalValue: 1,
      intervalUnit: "days",
      repeatCount: 1,
      repeatDelaySeconds: 0,
      action: {
        source: "ollama",
        template: "",
        prompt: "Think about 30 different short clean jokes then pick a randome one for the {server} Discord server. Return only the joke with heading: ## ?? Daily Joke.",
        jokesFile: defaultJokesFileName
      }
    }
  },
  {
    id: "daily-tip-template",
    scope: "schedule",
    name: "Daily Tip",
    description: "Post one short practical daily tip with plain template text.",
    scheduleDefaults: {
      triggerMode: "cron",
      cron: "0 8 * * *",
      intervalValue: 1,
      intervalUnit: "days",
      repeatCount: 1,
      repeatDelaySeconds: 0,
      action: {
        source: "template",
        template: "Daily tip for {server}: stay curious, stay kind, and share one useful thing you learned today.",
        prompt: "",
        jokesFile: defaultJokesFileName
      }
    }
  },
  {
    id: "question-of-the-day",
    scope: "schedule",
    name: "Question Of The Day",
    description: "Ask LazyDev for a fresh community prompt every day.",
    scheduleDefaults: {
      triggerMode: "cron",
      cron: "0 11 * * *",
      intervalValue: 1,
      intervalUnit: "days",
      repeatCount: 1,
      repeatDelaySeconds: 0,
      action: {
        source: "ollama",
        template: "",
        prompt: "Think about 30 questions then pick 1 randomly and write one short question of the day for the {server} Discord server. Make it friendly and conversation-starting. Return only the question with ?? emoji and header: ## ?Daily Question",
        jokesFile: defaultJokesFileName
      }
    }
  },
  {
    id: "weekday-check-in",
    scope: "schedule",
    name: "Weekday Check-In",
    description: "Send a short weekday opener every workday morning.",
    scheduleDefaults: {
      triggerMode: "cron",
      cron: "0 9 * * 1-5",
      intervalValue: 1,
      intervalUnit: "days",
      repeatCount: 1,
      repeatDelaySeconds: 0,
      action: {
        source: "template",
        template: "Good morning {server}. What are you working on today?",
        prompt: "",
        jokesFile: defaultJokesFileName
      }
    }
  },
  {
    id: "weekly-roundup-rod",
    scope: "schedule",
    name: "Weekly Roundup",
    description: "Ask LazyDev for a weekly community roundup prompt.",
    scheduleDefaults: {
      triggerMode: "cron",
      cron: "0 18 * * 0",
      intervalValue: 1,
      intervalUnit: "weeks",
      repeatCount: 1,
      repeatDelaySeconds: 0,
      action: {
        source: "ollama",
        template: "",
        prompt: "Write a short weekly roundup post for the {server} Discord server. Mention wins, community highlights, and one prompt for the week ahead. Return only the post.",
        jokesFile: defaultJokesFileName
      }
    }
  },
  {
    id: "evening-event-reminder",
    scope: "schedule",
    name: "Evening Event Reminder",
    description: "Post a reusable evening reminder before events or game nights.",
    scheduleDefaults: {
      triggerMode: "cron",
      cron: "30 18 * * 5",
      intervalValue: 1,
      intervalUnit: "weeks",
      repeatCount: 1,
      repeatDelaySeconds: 0,
      action: {
        source: "template",
        template: "Heads up {server}: tonight's event starts soon. Drop in, say hi, and bring a friend if you want.",
        prompt: "",
        jokesFile: defaultJokesFileName
      }
    }
  },
  {
    id: "daily-reminder-template",
    scope: "schedule",
    name: "Daily Reminder",
    description: "Send a plain text reminder on a cron schedule.",
    scheduleDefaults: {
      triggerMode: "cron",
      cron: "0 10 * * *",
      intervalValue: 1,
      intervalUnit: "days",
      repeatCount: 1,
      repeatDelaySeconds: 0,
      action: {
        source: "template",
        template: "Daily check-in for {server}.",
        prompt: "",
        jokesFile: defaultJokesFileName
      }
    }
  },
  {
    id: "daily-text-to-image",
    scope: "schedule",
    name: "Daily Text To Image",
    description: "Generate and post a fresh image from a text prompt every day.",
    scheduleDefaults: {
      triggerMode: "cron",
      cron: "0 9 * * *",
      intervalValue: 1,
      intervalUnit: "days",
      repeatCount: 1,
      repeatDelaySeconds: 0,
      action: {
        source: "image",
        template: "",
        prompt: "cozy community poster art for {server}, warm lighting, detailed illustration, vibrant colors, safe for work, high quality",
        jokesFile: defaultJokesFileName,
        imageAutoPrompt: false
      }
    }
  },
  {
    id: "daily-3d-model",
    scope: "schedule",
    name: "Daily 3D Model",
    description: "Generate and post a 3D model from a configured source image on a schedule.",
    scheduleDefaults: {
      triggerMode: "cron",
      cron: "0 9 * * *",
      intervalValue: 1,
      intervalUnit: "days",
      repeatCount: 1,
      repeatDelaySeconds: 0,
      action: {
        source: "model-3d",
        template: "",
        prompt: "",
        jokesFile: defaultJokesFileName,
        modelImage: ""
      }
    }
  },
  {
    id: "join-onboarding-checklist",
    scope: "member-join",
    name: "Join Onboarding Checklist",
    description: "Send a quick checklist after a new member joins.",
    joinDefaults: {
      delaySeconds: 15,
      action: {
        source: "template",
        template: "Welcome {user}. Start with the rules, pick your roles if your server uses them, and introduce yourself when you're ready.",
        prompt: "",
        jokesFile: defaultJokesFileName
      }
    }
  },
  {
    id: "join-server-tip-rod",
    scope: "member-join",
    name: "Join Tip From LazyDev",
    description: "Ask LazyDev for a short helpful onboarding tip after join.",
    joinDefaults: {
      delaySeconds: 25,
      action: {
        source: "ollama",
        template: "",
        prompt: "Write one short warm onboarding tip for {username} joining {server}. Return only the message.",
        jokesFile: defaultJokesFileName
      }
    }
  },
  {
    id: "join-rules-reminder",
    scope: "member-join",
    name: "Rules Reminder",
    description: "Send a gentle reminder to read the rules after joining.",
    joinDefaults: {
      delaySeconds: 30,
      action: {
        source: "template",
        template: "{user}, before you dive in, take a quick look at the rules and pinned info so everything goes smoothly.",
        prompt: "",
        jokesFile: defaultJokesFileName
      }
    }
  },
  {
    id: "join-followup-joke-file",
    scope: "member-join",
    name: "Join Follow-up Joke From File",
    description: "After a new member joins, send a random joke from jokes.txt.",
    joinDefaults: {
      delaySeconds: 20,
      action: {
        source: "jokes-file",
        template: "",
        prompt: "",
        jokesFile: defaultJokesFileName
      }
    }
  },
  {
    id: "join-followup-joke-ollama",
    scope: "member-join",
    name: "Join Follow-up Joke From LazyDev",
    description: "After a new member joins, ask LazyDev for a short welcome joke.",
    joinDefaults: {
      delaySeconds: 20,
      action: {
        source: "ollama",
        template: "",
        prompt: "Write one short clean welcome joke for {username} joining {server}. Return only the joke.",
        jokesFile: defaultJokesFileName
      }
    }
  },
  {
    id: "join-followup-template",
    scope: "member-join",
    name: "Join Follow-up Message",
    description: "Send a custom follow-up message shortly after join.",
    joinDefaults: {
      delaySeconds: 10,
      action: {
        source: "template",
        template: "Good to have you here, {user}. Check the channel list and have fun.",
        prompt: "",
        jokesFile: defaultJokesFileName
      }
    }
  }
];
