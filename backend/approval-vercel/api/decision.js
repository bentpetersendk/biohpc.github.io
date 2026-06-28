import { handleDecision } from "./_lib/approval.js";

export default {
  async fetch(request) {
    return handleDecision(request);
  },
};
