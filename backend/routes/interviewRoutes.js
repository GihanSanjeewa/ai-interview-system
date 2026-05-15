const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const { startInterview, getNextQuestion, completeInterview, getInterviewHistory } = require("../controllers/interviewController");

router.get("/history", auth, getInterviewHistory);
router.post("/start", auth, startInterview);
router.post("/next", auth, getNextQuestion);
router.post("/complete", auth, completeInterview);

module.exports = router;
