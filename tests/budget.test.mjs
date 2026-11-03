import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBudget } from '../candidate/src/budget.mjs';
const messages = {
  "required": "יש להזין תקציב מינימלי ומקסימלי.",
  "number": "יש להזין סכומים מספריים בלבד.",
  "precision": "יש להזין סכומים עם עד שתי ספרות אחרי הנקודה.",
  "positive": "התקציב חייב להיות גדול מאפס.",
  "order": "התקציב המקסימלי חייב להיות גדול או שווה למינימלי.",
  "ok": "טווח התקציב תקין."
};
const vectors = [
  [
    "missing minimum",
    "",
    "100",
    "required"
  ],
  [
    "missing maximum",
    "100",
    "",
    "required"
  ],
  [
    "blank minimum",
    " ",
    "200",
    "required"
  ],
  [
    "letters",
    "א",
    "200",
    "number"
  ],
  [
    "nonfinite",
    "100",
    "Infinity",
    "number"
  ],
  [
    "exponent",
    "1e2",
    "200",
    "number"
  ],
  [
    "negative minimum",
    "-1",
    "100",
    "positive"
  ],
  [
    "zero minimum",
    "0",
    "100",
    "positive"
  ],
  [
    "negative maximum",
    "100",
    "-1",
    "positive"
  ],
  [
    "zero maximum",
    "100",
    "0",
    "positive"
  ],
  [
    "reversed",
    "200",
    "100",
    "order"
  ],
  [
    "equal",
    "100",
    "100",
    "ok"
  ],
  [
    "increasing",
    "100",
    "200",
    "ok"
  ],
  [
    "trim without replacing inputs",
    " 100 ",
    " 200 ",
    "ok"
  ],
  [
    "decimal cents",
    "1.25",
    "2.50",
    "ok"
  ],
  [
    "too precise",
    "1.001",
    "2.00",
    "precision"
  ]
];
for (const [name,min,max,code] of vectors) {
  test(name, () => {
    assert.deepEqual(validateBudget(min,max), {ok:code==='ok',code,message:messages[code],values:{min,max}});
  });
}
