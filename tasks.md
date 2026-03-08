# Development Log

TODO

## Next Steps

- Let's remove the time ruler from the control panel and get rid of all its related code (without breaking anything else).
- Let's move the set sprint start (flag) button up ther closer to the scrubber.
- Find what unit of measurement for the angular measures is more appropriate for biomechanical analysis. What values do researchers like Ken Clarke and Peter Weyand find in their papers - especially the 'whip from the hip' paper about thigh angular velocity?
- The first ground contact won't have a stride length value. I think we can get one by allowing it to be annotated using the point at which the CoM crosses the start point as a reference (duh!).
- Increase the font size in the telemetry section
- Work towards body view looking more like Three.js human model.
- 3D mode is a must. Alternatives to Three.js? Just to make sure there isn't a simpler but more appropriate tool (or we can't build one quickly) before I go forward with it.
- When using the export option, let the draw box disappear after I close the panel.
- When done, create desktop version (Electron.js?) so that I don't have to upload anything. Find a way to run the application on the desktop and run the Python server on the laptop as well. Will have to figure out how to manage both seamlessly (web sockets)?

## Backend

- Deploy to Fly.io because free tier is more generous and doesn't hibernate? Regardless can write code to warm up the server
-

## Documentation

- Need to find a way to get the Test Driven Development stuff done.
- Add a help section where we'll write some guides to help users. Will record a demo video and post on YouTube and link here. Will provide a download sample so users can test the platform without having their own sprint video. Can use modals to guide the user on what to do. Allow the user to turn off the modal for subsequent visits and store that in local storage but have the option to turn it back on so that it shows up every time they open the application.
- Use Claude Code to scan all the files and write documentation for every aspect of the codebase (especially the math parts. Let's make the equations be done in LaTEX). Let it explain the design decisions and everything. Then host the docs somewhere and link to it in the README.md. Claude can probably help me set that up.
- Speaking of README.md. Let Claude Code scan the entire codebase and write a really good one (for the entire project and also for the frontend and backend)
- Go to Community Standards (https://github.com/mvch1ne/sprintlab/community) and create these things so that the project is up to standard. Ask Claude Code for the things I can do that will make my project stand out.
- Work on my GitHub profile's README.md to make it better.
