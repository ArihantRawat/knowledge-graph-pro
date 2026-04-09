import { combineSourceGraphs } from "./graph-merge.js";

export function demoGraph({ sources } = {}) {
  const graphs = demoSourceGraphs();
  const requested = new Set(sources && sources.length ? sources : graphs.map((entry) => entry.sourceId));
  return combineSourceGraphs(graphs.filter((entry) => requested.has(entry.sourceId)));
}

function demoSourceGraphs() {
  return [
    createSourceGraph("slack", 26, [
      edge("me", "maya", 18, {
        directMessages: 9,
        mentions: 2,
        sharedChannelSignals: 1,
        channels: ["DM with Maya", "#launch-room"],
        topTopics: ["Launch Plan", "Feedback Loop", "Timeline Risk"],
        relationshipLabel: "Core collaborator",
        conversationBrief: "Fast-moving launch coordination and decision making.",
        conversationSpacesBrief: "Mix of DMs and shared channels."
      }),
      edge("me", "jordan", 12, {
        directMessages: 4,
        mentions: 1,
        sharedChannelSignals: 2,
        channels: ["DM with Jordan", "#design-ops"],
        topTopics: ["Design Review", "Experiment Results", "Sprint Scope"],
        relationshipLabel: "Strong collaborator",
        conversationBrief: "Design iteration and experiment review.",
        conversationSpacesBrief: "Mostly DMs plus one shared channel."
      }),
      edge("me", "sam", 6, {
        mentions: 1,
        sharedChannelSignals: 2,
        channels: ["#community", "#partner-rollout"],
        topTopics: ["Partner Intro", "Channel Feedback", "Outreach Copy"],
        relationshipLabel: "Occasional collaborator",
        conversationBrief: "Community coordination and external outreach.",
        conversationSpacesBrief: "Shared Slack channels."
      })
    ]),
    createSourceGraph("jira", 22, [
      edge("me", "maya", 20, {
        mentions: 4,
        sharedChannelSignals: 9,
        channels: ["Project PAY", "Project WEB"],
        topTopics: ["Checkout Flow", "Payment Retry", "Release Blockers"],
        relationshipLabel: "Core collaborator",
        conversationBrief: "Core delivery planning across payments and web.",
        conversationSpacesBrief: "Shared across multiple Jira projects."
      }),
      edge("me", "priya", 11, {
        mentions: 2,
        sharedChannelSignals: 5,
        channels: ["Project OPS", "Project PAY"],
        topTopics: ["Runbook Updates", "Escalation Policy", "Support Handoff"],
        relationshipLabel: "Team channel partner",
        conversationBrief: "Support and operational coordination.",
        conversationSpacesBrief: "Shared project work."
      }),
      edge("me", "alex", 8, {
        mentions: 1,
        sharedChannelSignals: 3,
        channels: ["Project MOB"],
        topTopics: ["Ios Release", "Crash Rate", "Regression"],
        relationshipLabel: "Occasional collaborator",
        conversationBrief: "Mobile release quality and bug fixing.",
        conversationSpacesBrief: "One shared delivery stream."
      })
    ]),
    createSourceGraph("google-workspace", 18, [
      edge("me", "priya", 10, {
        sharedChannelSignals: 4,
        channels: ["Meet Weekly Review", "Drive Ops Folder"],
        topTopics: ["Weekly Review", "Docs Alignment", "Metrics Recap"],
        relationshipLabel: "Strong collaborator",
        conversationBrief: "Recurring syncs and shared docs.",
        conversationSpacesBrief: "Meetings plus shared docs."
      }),
      edge("me", "chris", 9, {
        sharedChannelSignals: 4,
        channels: ["Meet Staff Sync", "Drive Forecast"],
        topTopics: ["Forecast", "Roadmap Review", "Capacity Planning"],
        relationshipLabel: "Strong collaborator",
        conversationBrief: "Planning cadence and forecast updates.",
        conversationSpacesBrief: "Recurring planning sessions."
      }),
      edge("me", "jordan", 6, {
        sharedChannelSignals: 2,
        channels: ["Docs UX Brief"],
        topTopics: ["UX Brief", "Copy Review", "Approval Notes"],
        relationshipLabel: "Occasional collaborator",
        conversationBrief: "Design and documentation approvals.",
        conversationSpacesBrief: "Shared docs."
      })
    ]),
    createSourceGraph("notion", 15, [
      edge("me", "sam", 9, {
        sharedChannelSignals: 3,
        channels: ["Notion Growth Wiki", "Notion Partner Hub"],
        topTopics: ["Campaign Notes", "Playbook", "Partner Checklist"],
        relationshipLabel: "Strong collaborator",
        conversationBrief: "Documented playbooks and execution notes.",
        conversationSpacesBrief: "Shared pages and databases."
      }),
      edge("me", "maya", 7, {
        sharedChannelSignals: 2,
        channels: ["Notion Launch Specs"],
        topTopics: ["Launch Spec", "Ownership", "Milestones"],
        relationshipLabel: "Occasional collaborator",
        conversationBrief: "Planning docs and launch specs.",
        conversationSpacesBrief: "One shared doc stream."
      }),
      edge("me", "chris", 5, {
        sharedChannelSignals: 2,
        channels: ["Notion Planning OS"],
        topTopics: ["Operating Model", "Review Cadence", "Templates"],
        relationshipLabel: "Light connection",
        conversationBrief: "Ops templates and review structure.",
        conversationSpacesBrief: "Shared workspace structure."
      })
    ]),
    createSourceGraph("zoom", 17, [
      edge("me", "jordan", 9, {
        sharedChannelSignals: 4,
        channels: ["Zoom Design Crit", "Zoom Sprint Retro"],
        topTopics: ["Critique", "Retro", "Tradeoffs"],
        relationshipLabel: "Strong collaborator",
        conversationBrief: "Regular meetings with action-heavy follow-through.",
        conversationSpacesBrief: "Recurring sessions."
      }),
      edge("me", "chris", 11, {
        sharedChannelSignals: 5,
        channels: ["Zoom Leadership Sync", "Zoom Forecast Review"],
        topTopics: ["Leadership Sync", "Forecast", "Dependencies"],
        relationshipLabel: "Strong collaborator",
        conversationBrief: "Leadership alignment and dependency review.",
        conversationSpacesBrief: "Leadership and planning meetings."
      }),
      edge("me", "alex", 6, {
        sharedChannelSignals: 2,
        channels: ["Zoom Mobile QA"],
        topTopics: ["Bug Review", "QA Blockers", "Release Readiness"],
        relationshipLabel: "Occasional collaborator",
        conversationBrief: "Focused debugging and release sessions.",
        conversationSpacesBrief: "Project-specific meetings."
      })
    ]),
    createSourceGraph("trello", 14, [
      edge("me", "alex", 10, {
        sharedChannelSignals: 4,
        channels: ["Board Mobile QA", "Board Release Checklists"],
        topTopics: ["Checklist", "Handoff", "Regression Sweep"],
        relationshipLabel: "Strong collaborator",
        conversationBrief: "Execution handoffs and shipping readiness.",
        conversationSpacesBrief: "Boards and card movement."
      }),
      edge("me", "sam", 7, {
        sharedChannelSignals: 3,
        channels: ["Board Campaign Ops"],
        topTopics: ["Campaign Tasks", "Owners", "Deadlines"],
        relationshipLabel: "Occasional collaborator",
        conversationBrief: "Task tracking and cross-team handoffs.",
        conversationSpacesBrief: "One delivery board."
      }),
      edge("me", "maya", 6, {
        sharedChannelSignals: 2,
        channels: ["Board Launch PMO"],
        topTopics: ["Milestones", "Dependencies", "Ship List"],
        relationshipLabel: "Occasional collaborator",
        conversationBrief: "Launch execution and milestone tracking.",
        conversationSpacesBrief: "Shared board workflow."
      })
    ]),
    createSourceGraph("github", 24, [
      edge("me", "alex", 12, {
        sharedChannelSignals: 5,
        channels: ["Repo mobile-app", "Repo release-tools"],
        topTopics: ["Pull Request Review", "Release Automation", "Regression Fix"],
        relationshipLabel: "Strong collaborator",
        conversationBrief: "Engineering review and release tooling collaboration.",
        conversationSpacesBrief: "Shared repos and review threads."
      }),
      edge("me", "maya", 8, {
        sharedChannelSignals: 3,
        channels: ["Repo web-checkout"],
        topTopics: ["Checkout Bug", "Spec Followthrough", "Release Notes"],
        relationshipLabel: "Occasional collaborator",
        conversationBrief: "Product-delivery followthrough on engineering changes.",
        conversationSpacesBrief: "One shared repo stream."
      }),
      edge("me", "chris", 6, {
        sharedChannelSignals: 2,
        channels: ["Repo platform-observability"],
        topTopics: ["Observability", "PR Feedback", "Incident Context"],
        relationshipLabel: "Occasional collaborator",
        conversationBrief: "Platform code review and reliability follow-up.",
        conversationSpacesBrief: "Shared engineering work."
      })
    ]),
    createSourceGraph("linear", 19, [
      edge("me", "maya", 11, {
        sharedChannelSignals: 4,
        channels: ["Linear Checkout", "Linear Launch Board"],
        topTopics: ["Cycle Planning", "Scope Tradeoffs", "Priority Queue"],
        relationshipLabel: "Strong collaborator",
        conversationBrief: "Execution planning and launch scoping.",
        conversationSpacesBrief: "Shared Linear projects."
      }),
      edge("me", "jordan", 9, {
        sharedChannelSignals: 3,
        channels: ["Linear UX Improvements"],
        topTopics: ["Backlog Grooming", "Acceptance Criteria", "Design Debt"],
        relationshipLabel: "Occasional collaborator",
        conversationBrief: "Product-design execution and issue shaping.",
        conversationSpacesBrief: "One issue stream."
      }),
      edge("me", "priya", 7, {
        sharedChannelSignals: 2,
        channels: ["Linear Ops Queue"],
        topTopics: ["Escalation Queue", "Triage", "Dependencies"],
        relationshipLabel: "Occasional collaborator",
        conversationBrief: "Operational task tracking and prioritization.",
        conversationSpacesBrief: "Shared Linear triage."
      })
    ]),
    createSourceGraph("confluence", 16, [
      edge("me", "chris", 10, {
        sharedChannelSignals: 4,
        channels: ["Space Planning", "Space Leadership"],
        topTopics: ["Planning Docs", "Operating Model", "Decision Log"],
        relationshipLabel: "Strong collaborator",
        conversationBrief: "Shared authorship of planning and operating documents.",
        conversationSpacesBrief: "Multiple shared Confluence spaces."
      }),
      edge("me", "maya", 7, {
        sharedChannelSignals: 3,
        channels: ["Space Product Launch"],
        topTopics: ["Launch Brief", "Milestones", "Decision Notes"],
        relationshipLabel: "Occasional collaborator",
        conversationBrief: "Launch documentation and cross-team references.",
        conversationSpacesBrief: "One shared documentation stream."
      }),
      edge("me", "sam", 5, {
        sharedChannelSignals: 2,
        channels: ["Space Partnerships"],
        topTopics: ["Partner Playbook", "Notes", "Templates"],
        relationshipLabel: "Light connection",
        conversationBrief: "Knowledge base updates for partnership execution.",
        conversationSpacesBrief: "One shared knowledge space."
      })
    ]),
    createSourceGraph("gmail-calendar", 23, [
      edge("me", "chris", 12, {
        sharedChannelSignals: 5,
        channels: ["Weekly Forecast", "Leadership Review", "Budget Planning"],
        topTopics: ["Forecast", "Budget", "Followup"],
        relationshipLabel: "Strong collaborator",
        conversationBrief: "Recurring planning meetings and follow-up email threads.",
        conversationSpacesBrief: "Calendar events and email cadence."
      }),
      edge("me", "priya", 9, {
        sharedChannelSignals: 4,
        channels: ["Support Review", "On-call Debrief"],
        topTopics: ["Incident Followup", "Escalation Notes", "Action Items"],
        relationshipLabel: "Strong collaborator",
        conversationBrief: "High-frequency support and incident coordination.",
        conversationSpacesBrief: "Recurring ops meetings."
      }),
      edge("me", "jordan", 6, {
        sharedChannelSignals: 2,
        channels: ["Design Review Calendar"],
        topTopics: ["Review Notes", "Agenda", "Feedback Loop"],
        relationshipLabel: "Occasional collaborator",
        conversationBrief: "Meeting cadence around design reviews and feedback.",
        conversationSpacesBrief: "One recurring event stream."
      })
    ]),
    createSourceGraph("figma", 13, [
      edge("me", "jordan", 10, {
        sharedChannelSignals: 4,
        channels: ["Figma Checkout Redesign", "Figma Experiment Board"],
        topTopics: ["Comment Threads", "Prototype Feedback", "UX Polish"],
        relationshipLabel: "Strong collaborator",
        conversationBrief: "Tight design collaboration through prototypes and comments.",
        conversationSpacesBrief: "Multiple shared design files."
      }),
      edge("me", "maya", 6, {
        sharedChannelSignals: 2,
        channels: ["Figma Launch Narrative"],
        topTopics: ["Review Notes", "Handoff", "Approval"],
        relationshipLabel: "Occasional collaborator",
        conversationBrief: "Product review and handoff around key flows.",
        conversationSpacesBrief: "One shared file stream."
      }),
      edge("me", "sam", 4, {
        sharedChannelSignals: 1,
        channels: ["Figma Partner Assets"],
        topTopics: ["Asset Review", "Brand Notes", "Comment Threads"],
        relationshipLabel: "Light connection",
        conversationBrief: "Occasional asset review and collaboration.",
        conversationSpacesBrief: "Light shared design work."
      })
    ])
  ];
}

function createSourceGraph(sourceId, scanned, edges) {
  const people = new Set(["me"]);
  for (const current of edges) {
    people.add(current.source);
    people.add(current.target);
  }

  return {
    sourceId,
    graph: {
      generatedAt: new Date().toISOString(),
      me: "me",
      stats: {
        people: people.size,
        relationships: edges.length,
        conversationsScanned: scanned
      },
      nodes: Array.from(people).map((personId) => node(personId)),
      edges
    }
  };
}

function node(personId) {
  const people = {
    me: { id: "me", label: "You", handle: "you@company.com", kind: "self", score: 1 },
    maya: { id: "maya", label: "Maya Chen", handle: "maya@company.com", kind: "person", score: 20 },
    jordan: { id: "jordan", label: "Jordan Lee", handle: "jordan@company.com", kind: "person", score: 14 },
    priya: { id: "priya", label: "Priya Shah", handle: "priya@company.com", kind: "person", score: 12 },
    alex: { id: "alex", label: "Alex Kim", handle: "alex@company.com", kind: "person", score: 10 },
    sam: { id: "sam", label: "Sam Rivera", handle: "sam@company.com", kind: "person", score: 9 },
    chris: { id: "chris", label: "Chris Gomez", handle: "chris@company.com", kind: "person", score: 11 }
  };

  return people[personId];
}

function edge(source, target, weight, details) {
  return {
    id: `${source}:${target}`,
    source,
    target,
    weight,
    directMessages: details.directMessages || 0,
    mentions: details.mentions || 0,
    sharedChannelSignals: details.sharedChannelSignals || 0,
    channels: details.channels || [],
    reasons: buildReasons(details),
    relationship: {
      label: details.relationshipLabel,
      summary: `${weight} weighted signals within this source.`
    },
    topTopics: details.topTopics || [],
    conversationBrief: details.conversationBrief || "",
    conversationSpacesBrief: details.conversationSpacesBrief || ""
  };
}

function buildReasons(details) {
  const reasons = [];
  if (details.directMessages) {
    reasons.push(`${details.directMessages} direct messages`);
  }
  if (details.mentions) {
    reasons.push(`${details.mentions} mentions`);
  }
  if (details.sharedChannelSignals) {
    reasons.push(`${details.sharedChannelSignals} shared signals`);
  }
  return reasons;
}
