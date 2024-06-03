const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express.json();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());