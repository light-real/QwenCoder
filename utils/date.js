﻿function formatDate(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(date) {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

function getCurrentDate() {
  return formatDate(new Date());
}

function getCurrentTime() {
  return formatTime(new Date());
}

function getCurrentDateTime() {
  return formatDateTime(new Date());
}

module.exports = {
  formatDate,
  formatTime,
  formatDateTime,
  getCurrentDate,
  getCurrentTime,
  getCurrentDateTime,
};
