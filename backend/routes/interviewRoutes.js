const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const { startInterview, getNextQuestion, completeInterview } = require("../controllers/interviewController");

router.post("/start", auth, startInterview);
router.post("/next", auth, getNextQuestion);
router.post("/complete", auth, completeInterview);

module.exports = router;
