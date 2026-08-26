require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

// =====================================================
// INDIA TIMEZONE
// =====================================================

const INDIA_TIMEZONE = "Asia/Kolkata";


// =====================================================
// EJS
// =====================================================

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));


// =====================================================
// GET CURRENT DATE/TIME IN INDIA
// =====================================================

function getIndiaDateParts() {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23"
  });

  const parts = formatter.formatToParts(now);

  const result = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] = Number(part.value);
    }
  }

  return {
    year: result.year,
    month: result.month,
    day: result.day,
    hour: result.hour,
    minute: result.minute,
    second: result.second
  };
}


// =====================================================
// CREATE A DATE REPRESENTING A SPECIFIC IST TIME
// =====================================================
//
// This converts a date/time in India into the correct
// JavaScript timestamp, regardless of server timezone.
//
// Example:
// September 1, 2026 00:00 IST
//
// =====================================================

function indiaTimeToTimestamp(
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0
) {
  /*
   * India is UTC+05:30.
   *
   * Convert Indian local time to UTC.
   */

  const utcTimestamp = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  );

  // IST = UTC + 5 hours 30 minutes
  const IST_OFFSET = 5.5 * 60 * 60 * 1000;

  return utcTimestamp - IST_OFFSET;
}


// =====================================================
// BIRTHDAY INFORMATION
// =====================================================
//
// Birthday:
// September 1
//
// Birthday starts:
// September 1, 12:00 AM IST
//
// Birthday ends:
// September 2, 12:00 AM IST
//
// After September 1:
// Countdown to next September 1.
//
// =====================================================

function getBirthdayInfo() {
  const now = new Date();

  // Current date/time specifically in India
  const india = getIndiaDateParts();

  const currentYear = india.year;

  // ---------------------------------------------------
  // September 1, 12:00 AM IST
  // ---------------------------------------------------

  const birthdayThisYear = indiaTimeToTimestamp(
    currentYear,
    9,
    1,
    0,
    0,
    0
  );


  // ---------------------------------------------------
  // September 2, 12:00 AM IST
  // ---------------------------------------------------

  const birthdayEnd = indiaTimeToTimestamp(
    currentYear,
    9,
    2,
    0,
    0,
    0
  );


  // ---------------------------------------------------
  // Is it currently September 1 in India?
  // ---------------------------------------------------

  const isBirthday =
    now.getTime() >= birthdayThisYear &&
    now.getTime() < birthdayEnd;


  // ---------------------------------------------------
  // Determine countdown target
  // ---------------------------------------------------

  let target;

  if (isBirthday) {

    /*
     * Birthday is already active.
     * Target is birthday start.
     */

    target = birthdayThisYear;

  } else if (now.getTime() < birthdayThisYear) {

    /*
     * Before September 1.
     *
     * Countdown to September 1 this year.
     */

    target = birthdayThisYear;

  } else {

    /*
     * September 1 has passed.
     *
     * Countdown to September 1 next year.
     */

    target = indiaTimeToTimestamp(
      currentYear + 1,
      9,
      1,
      0,
      0,
      0
    );
  }


  // ---------------------------------------------------
  // Countdown difference
  // ---------------------------------------------------

  const difference = Math.max(
    0,
    target - now.getTime()
  );

  const totalSeconds = Math.floor(
    difference / 1000
  );


  // ---------------------------------------------------
  // Convert seconds
  // ---------------------------------------------------

  const days = Math.floor(
    totalSeconds / 86400
  );

  const hours = Math.floor(
    (totalSeconds % 86400) / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const seconds =
    totalSeconds % 60;


  // ---------------------------------------------------
  // Return information to EJS
  // ---------------------------------------------------

  return {
    isBirthday,

    targetTime: target,

    days,
    hours,
    minutes,
    seconds,

    timezone: INDIA_TIMEZONE
  };
}


// =====================================================
// LOGIN MIDDLEWARE
// =====================================================

function requireLogin(req, res, next) {

  if (req.session.loggedIn) {
    return next();
  }

  res.redirect("/login");
}


// =====================================================
// LOGIN PAGE
// =====================================================

app.get("/login", (req, res) => {

  if (req.session.loggedIn) {
    return res.redirect("/");
  }

  res.render("login", {
    error: null
  });
});


// =====================================================
// LOGIN
// =====================================================

app.post("/login", async (req, res) => {

  const {
    username,
    password
  } = req.body;


  const correctUsername =
    process.env.LOGIN_USERNAME;

  const passwordHash =
    process.env.LOGIN_PASSWORD_HASH;


  // ---------------------------------------------------
  // Check configuration
  // ---------------------------------------------------

  if (
    !correctUsername ||
    !passwordHash
  ) {
    return res
      .status(500)
      .send(
        "Login configuration is missing."
      );
  }


  // ---------------------------------------------------
  // Check username
  // ---------------------------------------------------

  const usernameMatches =
    username === correctUsername;


  // ---------------------------------------------------
  // Check password
  // ---------------------------------------------------

  let passwordMatches = false;

  try {

    passwordMatches =
      await bcrypt.compare(
        password,
        passwordHash
      );

  } catch (error) {

    console.error(
      "Password comparison error:",
      error
    );
  }


  // ---------------------------------------------------
  // Login successful
  // ---------------------------------------------------

  if (
    usernameMatches &&
    passwordMatches
  ) {

    req.session.loggedIn = true;

    req.session.username =
      username;

    return res.redirect("/");
  }


  // ---------------------------------------------------
  // Login failed
  // ---------------------------------------------------

  res.status(401).render("login", {
    error:
      "Incorrect username or password."
  });
});


// =====================================================
// LOGOUT
// =====================================================

app.post("/logout", (req, res) => {

  req.session.destroy(() => {

    res.redirect("/login");

  });
});


// =====================================================
// BIRTHDAY PAGE
// =====================================================

app.get(
  "/",
  requireLogin,
  (req, res) => {

    const birthday =
      getBirthdayInfo();


    res.render("birthday", {
      birthday
    });

  }
);


// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {

  console.log(
    `Birthday app running at http://localhost:${PORT}`
  );

  console.log(
    `Birthday timezone: ${INDIA_TIMEZONE}`
  );

});
