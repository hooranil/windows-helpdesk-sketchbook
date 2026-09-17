# The Command Sketchbook

One hundred Windows help desk commands, one to a page, in a book you turn.

Open the left page and you get the command and a plain comparison for what it
does. Open the right page and you get what it is, what it does, when you would
reach for it on a real call, and what to look at in the output. Tick the ones
you ran, write down what you saw, and the page writes the note for your ticket.

Nothing runs from this page. It is a reference, a checklist and a note writer.

## Run it

There is no build step, no server and no account. Clone it and open the file.

```bash
git clone https://github.com/hooranil/windows-helpdesk-sketchbook.git
```

Then open `index.html` in a browser.

Some browsers will not load a font from a plain file path. If the type looks
wrong, serve the folder instead. Python is already on macOS and most Linux
machines:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. To reach it from a phone or a tablet on the
same network, add `--bind 0.0.0.0` and use the computer's address instead of
`localhost`.

## What is in it

| Path | What it holds |
| --- | --- |
| `data/commands.js` | The hundred commands. The only place command content lives. |
| `data/SOURCES.md` | Where the facts came from, and where two sources disagreed. |
| `app/core.js` | All the behaviour. Selecting, filtering, the ticket note, copying. |
| `app/paper.css` | The design system. Palette, type scale, the shared parts. |
| `app/sheet.js` | The paper itself, drawn in code. Fold, seam, cut edge, tooth. |
| `index.html` | The book. Page turning, the reading glass, the index, the notes. |
| `smoke.js` | Checks the data and the behaviour without a browser. |

The command data is kept apart from everything that draws it. To add a command,
add an object to `data/commands.js` and it appears in the book, in the index, in
the search and in the filters. No other file needs to change.

## Checking it

`smoke.js` checks the whole thing without a browser: that all 100 commands are
present and complete, that the filters and the search do what they say, that the
ticket note carries no markup characters and invents nothing, that a pasted
result cannot break the note, and that there is no code path that executes a
command.

```bash
node smoke.js
```

No node installed? It runs in a container with nothing to set up:

```bash
docker run --rm -v "$PWD":/app:ro node:22-alpine node /app/smoke.js
```

## The commands

Ten categories: system information, network and internet, Wi-Fi and the network
stack, processes and services and startup, disk and storage, Windows repair and
updates, devices and drivers, Entra ID and Intune and group policy, security and
certificates and encryption, and performance and power and logs.

Every command was checked against Microsoft's documentation before it was
written down. Syntax, switches, whether administrator rights are really needed,
and whether the command reads the system or changes it. Where two Microsoft
pages disagreed, both readings are recorded in `data/SOURCES.md` rather than one
being picked quietly.

Every command carries a plain comparison, because a help desk technician who is
new to a command remembers the comparison long after the switches are gone.

## Safety

This tool never executes anything. There is no code path that runs a command.

Commands are labelled as information only, a low risk change, or a system
change, and separately for administrator rights, a restart, and whether running
it can interrupt the user. Anything that changes the system prints a warning on
the page before you can copy it, and the copy button asks a second time.

No command in the set prints a password, a token, a certificate private key or a
BitLocker recovery key. That was deliberate, because the result field would then
carry a secret into a ticket.

Nothing you type is written to the browser. There is no local storage, no
cookie, and no analytics. Closing the tab clears your work. That is on purpose:
a technician can paste real output into a result field, and that output should
not outlive the call on a shared machine.

## The ticket note

Ticking a command adds it to the note. The note is plain text by default, with
no asterisks and no backticks, because those survive badly in a ticket field.
There is a markdown switch for tools that render it.

```
Troubleshooting performed:

1. Ran: netsh wlan show profiles
   Purpose: Checked for saved Wi-Fi profiles.
   Result: No corporate Wi-Fi profile was found.

Summary:
   Commands run: 1
   Key findings: No corporate Wi-Fi profile was found.
   Changes made: None. Every command run was information only.
   Restart required: No
```

A command you ticked but did not write a result for reads `Result: Not
documented.` Nothing is ever invented on your behalf.

## Getting around

| Key | What it does |
| --- | --- |
| Left and right arrow | Turn the page, when the book has focus |
| Drag the page | Turn it by hand |
| Drag the glass | Read the page under it, magnified |

Below the book there is a contents page, a search that looks at the command
name and at the problem, and filters for information only, changes the system,
administrator, restart needed and selected. Each plate has its own address, so
`#plate-029` opens the book at that command.

## Credits

The paper is not a texture file. It is drawn in code from a model written by
MMAH for an earlier sketchbook: the fold is a measured lighting curve rather
than a symmetric gradient, and the cold press tooth is lit as a directional
derivative so it reads as fibre instead of digital grain. See `app/sheet.js`.

Instrument Serif and Newsreader are used under the SIL Open Font License. The
licence travels with them in `assets/ref/LICENSE-fonts-OFL.md`.

## Licence

MIT. See `LICENSE`.
