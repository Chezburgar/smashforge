#!/bin/sh
# Syntax-check every game source file (skips vendor).
fail=0
for f in $(find js -name '*.js' | sort); do
  if ! node --check "$f" 2>/tmp/err; then
    echo "FAIL $f"; sed -n '1,6p' /tmp/err; fail=1
  fi
done
[ $fail -eq 0 ] && echo "syntax OK ($(find js -name '*.js' | wc -l) files)"
exit $fail
