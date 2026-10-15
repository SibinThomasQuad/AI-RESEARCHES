/**
 * Porter Stemmer implementation for English words.
 * Reduces words to their base root form for enhanced text matching.
 */

// Step 2 and Step 3 mapping tables
const step2list = {
  ational: "ate",
  tional: "tion",
  enci: "ence",
  anci: "ance",
  izer: "ize",
  bli: "ble",
  alli: "al",
  entli: "ent",
  eli: "e",
  ousli: "ous",
  ization: "ize",
  ation: "ate",
  ator: "ate",
  alism: "al",
  iveness: "ive",
  fulness: "ful",
  ousness: "ous",
  aliti: "al",
  iviti: "ive",
  biliti: "ble",
  logi: "log"
};

const step3list = {
  icate: "ic",
  ative: "",
  alize: "al",
  iciti: "ic",
  ical: "ic",
  ful: "",
  ness: ""
};

const c = "[^aeiou]"; // consonant
const v = "[aeiouy]"; // vowel
const C = c + "[^aeiouy]*"; // consonant sequence
const V = v + "[aeiou]*"; // vowel sequence

const mgr0 = "^(" + C + ")?" + V + C; // [C]VC... (m > 0)
const meq1 = "^(" + C + ")?" + V + C + "(" + V + ")?$"; // [C]VC[V] (m == 1)
const mgr1 = "^(" + C + ")?" + V + C + V + C; // [C]VCVC... (m > 1)
const s_v = "^(" + C + ")?" + v; // vowel in stem

function stem(word) {
  if (word.length < 3) return word;

  let firstch = word.substr(0, 1);
  if (firstch === "y") {
    word = "Y" + word.substr(1);
  }

  // Step 1a
  let re = /^(.+?)(ss|i)es$/;
  let re2 = /^(.+?)([^s])s$/;
  if (re.test(word)) {
    word = word.replace(re, "$1$2");
  } else if (re2.test(word)) {
    word = word.replace(re2, "$1$2");
  }

  // Step 1b
  re = /^(.+?)eed$/;
  re2 = /^(.+?)(ed|ing)$/;
  if (re.test(word)) {
    let fp = re.exec(word);
    re = new RegExp(mgr0);
    if (re.test(fp[1])) {
      re = /.$/;
      word = word.replace(re, "");
    }
  } else if (re2.test(word)) {
    let fp = re2.exec(word);
    let stemPart = fp[1];
    re2 = new RegExp(s_v);
    if (re2.test(stemPart)) {
      word = stemPart;
      re2 = /(at|bl|iz)$/;
      let re3 = new RegExp("([^aeiouylsz])\\1$");
      let re4 = new RegExp("^" + C + v + "[^aeiouwxy]$");
      if (re2.test(word)) {
        word = word + "e";
      } else if (re3.test(word)) {
        re = /.$/;
        word = word.replace(re, "");
      } else if (re4.test(word)) {
        word = word + "e";
      }
    }
  }

  // Step 1c
  re = /^(.+?)y$/;
  if (re.test(word)) {
    let fp = re.exec(word);
    let stemPart = fp[1];
    re = new RegExp(s_v);
    if (re.test(stemPart)) {
      word = stemPart + "i";
    }
  }

  // Step 2
  re = /^(.+?)(ational|tional|enci|anci|izer|bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|logi)$/;
  if (re.test(word)) {
    let fp = re.exec(word);
    let stemPart = fp[1];
    let suffix = fp[2];
    re = new RegExp(mgr0);
    if (re.test(stemPart)) {
      word = stemPart + step2list[suffix];
    }
  }

  // Step 3
  re = /^(.+?)(icate|ative|alize|iciti|ical|ful|ness)$/;
  if (re.test(word)) {
    let fp = re.exec(word);
    let stemPart = fp[1];
    let suffix = fp[2];
    re = new RegExp(mgr0);
    if (re.test(stemPart)) {
      word = stemPart + step3list[suffix];
    }
  }

  // Step 4
  re = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/;
  re2 = /^(.+?)(s|t)(ion)$/;
  if (re.test(word)) {
    let fp = re.exec(word);
    let stemPart = fp[1];
    re = new RegExp(mgr1);
    if (re.test(stemPart)) {
      word = stemPart;
    }
  } else if (re2.test(word)) {
    let fp = re2.exec(word);
    let stemPart = fp[1] + fp[2];
    re2 = new RegExp(mgr1);
    if (re2.test(stemPart)) {
      word = stemPart;
    }
  }

  // Step 5
  re = /^(.+?)e$/;
  if (re.test(word)) {
    let fp = re.exec(word);
    let stemPart = fp[1];
    re = new RegExp(mgr1);
    re2 = new RegExp(meq1);
    let re3 = new RegExp("^" + C + v + "[^aeiouwxy]$");
    if (re.test(stemPart) || (re2.test(stemPart) && !re3.test(stemPart))) {
      word = stemPart;
    }
  }

  re = /ll$/;
  re2 = new RegExp(mgr1);
  if (re.test(word) && re2.test(word)) {
    re = /.$/;
    word = word.replace(re, "");
  }

  if (firstch === "y") {
    word = "y" + word.substr(1);
  }

  return word;
}

module.exports = { stem };
