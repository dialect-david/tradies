# tradies

Job board over beads (`bd`) and GitHub PRs (`gh`), in the terminal. A house build: beads are trades on site,
PRs are the inspector, stale work is a tradie on smoko too long, and the Kelpie knows.

- `yarn start` in any beads workspace (and gh repo)
- keys: `j/k` move, `⏎` show, `c` claim, `n` note, `x` close (asks reason), `m` merge PR, `tab` beads/prs/all, `r` refresh, `q` quit
- state lives in bd and gh only; every action is a shell-out

Next: site pane (house stages per epic), Kelpie, smoko.
