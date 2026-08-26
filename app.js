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
// CONVERT INDIA TIME TO JAVASCRIPT TIMESTAMP
// =====================================================
//
// Example:
//
// September 1, 2026 12:00 AM IST
//
// becomes:
//
// 2026-08-31T18:30:00.000Z
//
// This is an absolute timestamp, so the browser timezone
// cannot change the actual countdown target.
// =====================================================

function indiaTimeToTimestamp(
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0
) {
  const isoString =
    `${year}-` +
    `${String(month).padStart(2, "0")}-` +
    `${String(day).padStart(2, "0")}T` +
    `${String(hour).padStart(2, "0")}:` +
    `${String(minute).padStart(2, "0")}:` +
    `${String(second).padStart(2, "0")}` +
    `+05:30`;

  return new Date(isoString).getTime();
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
// =====================================================

function getBirthdayInfo() {
  const now = new Date();

  const india = getIndiaDateParts();

  const currentYear = india.year;


  // ===================================================
  // BIRTHDAY START
  // September 1, 12:00 AM IST
  // ===================================================

  const birthdayThisYear =
    indiaTimeToTimestamp(
      currentYear,
      9,
      1,
      0,
      0,
      0
    );


  // ===================================================
  // BIRTHDAY END
  // September 2, 12:00 AM IST
  // ===================================================

  const birthdayEnd =
    indiaTimeToTimestamp(
      currentYear,
      9,
      2,
      0,
      0,
      0
    );


  // ===================================================
  // CHECK IF TODAY IS BIRTHDAY
  // ===================================================

  const isBirthday =
    now.getTime() >= birthdayThisYear &&
    now.getTime() < birthdayEnd;


  // ===================================================
  // DETERMINE COUNTDOWN TARGET
  // ===================================================

  let targetTime = null;


  if (isBirthday) {

    // -----------------------------------------------
    // Birthday is currently active.
    // -----------------------------------------------

    targetTime = null;

  } else if (now.getTime() < birthdayThisYear) {

    // -----------------------------------------------
    // Birthday has not happened yet this year.
    // -----------------------------------------------

    targetTime = birthdayThisYear;

  } else {

    // -----------------------------------------------
    // Birthday has already passed.
    // Countdown to next year's birthday.
    // -----------------------------------------------

    targetTime =
      indiaTimeToTimestamp(
        currentYear + 1,
        9,
        1,
        0,
        0,
        0
      );
  }


  // ===================================================
  // CALCULATE COUNTDOWN
  // ===================================================

  let days = 0;
  let hours = 0;
  let minutes = 0;
  let seconds = 0;


  if (targetTime !== null) {

    const difference =
      Math.max(
        0,
        targetTime - now.getTime()
      );


    const totalSeconds =
      Math.floor(
        difference / 1000
      );


    days =
      Math.floor(
        totalSeconds / 86400
      );


    hours =
      Math.floor(
        (totalSeconds % 86400) / 3600
      );


    minutes =
      Math.floor(
        (totalSeconds % 3600) / 60
      );


    seconds =
      totalSeconds % 60;
  }


  // ===================================================
  // RETURN DATA TO EJS
  // ===================================================

  return {
    isBirthday,

    targetTime,

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

  return res.redirect("/login");
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


  // ===================================================
  // CHECK CONFIGURATION
  // ===================================================

  if (
    !correctUsername ||
    !passwordHash
  ) {

    console.error(
      "LOGIN_USERNAME or LOGIN_PASSWORD_HASH is missing."
    );

    return res
      .status(500)
      .send(
        "Login configuration is missing."
      );
  }


  // ===================================================
  // CHECK USERNAME
  // ===================================================

  const usernameMatches =
    username === correctUsername;


  // ===================================================
  // CHECK PASSWORD
  // ===================================================

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


  // ===================================================
  // LOGIN SUCCESS
  // ===================================================

  if (
    usernameMatches &&
    passwordMatches
  ) {

    req.session.loggedIn = true;

    req.session.username =
      username;

    return res.redirect("/");
  }


  // ===================================================
  // LOGIN FAILED
  // ===================================================

  return res
    .status(401)
    .render("login", {
      error:
        "Incorrect username or password."
    });
});


// =====================================================
// LOGOUT
// =====================================================

app.post("/logout", (req, res) => {

  req.session.destroy((error) => {

    if (error) {

      console.error(
        "Logout error:",
        error
      );

      return res
        .status(500)
        .send("Unable to logout.");
    }

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
