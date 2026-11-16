/* Classroom Hub — frontend statis (GitHub Pages) + backend Google Apps Script.
 * Pola absensi-pkl: semua aksi lewat JSONP GET; upload file lewat POST no-cors
 * dua fase (upload dulu, lalu verifikasi dengan aksi baca).
 * TIDAK ADA secret di file ini — kode guru & PIN dicek di server.
 */

var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbykozMZCJOHdNG7WwgzdpI3Ix8SqWIpLUt2SPyrEKLO9WEa-LDbagX7XD_pr29x5uZj/exec';

var $ = function (id) { return document.getElementById(id); };

