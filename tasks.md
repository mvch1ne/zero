# Development Log

TODO

- Next Prompt after we resume:
  Here's the previous prompt before we were cut off.
  Block the computation it so that it can only move forward and compute if I have set two things:
- The first movement (sprint start - you will pick a frame, and I can override it). Create a marker on the scrubber and on the viewport at the exact frame you predict for this start point (think of it like when the gun went). Then I can use the button you are about to create (there's actually one there in the control panel with its own stuff [startFrame, onSetStartFrame, etc]). Just move it up and allow me to use it to override the start frame
- The start point or start line (this will be the reference for all displacements). The current code is doing the calculations right. It just needs the start line or start point to start from there. Now allow me to draw the start line diagonally so that you can pick which frame the CoM passed it.
  Also when you're done remove the CoM horizontal speed from the the telemetry summary since it's still using instantaneous values

Continue. For the start frame, even if you set it, let me set it (reconfirm) before we move forward. Also once, we cross the start line, displacement shouldn't be negative so velocity shouldn't be negative. But right now it is because it isn't clear what the start line is and what the sprint start frame is. You know what you're supposed to do but simplify it so the user just has to set the few things.

IMPORTANT: I should probably account the velocity calculations for the average sprint reaction time in the velocity calculations. So the velocity will compute and be realistic. What are your thoughts? Because if Bolt is getting to 10m in 1.83 with RT accounted for and I'm getting there in 1.83 without RT accounted, the velocity measurement will say we are the same but technically I am behind him. So pick a fixed reaction time and apply it to the first timepoint (just the first timepoint right?) when doing the calculations? That will affect acceleration too because of the elapsed time but the displacement technically doesn't change. So I guess we could say that this new elapsed time will be current time + estimated reaction time. Be sure to display this in the CoM panel. And even allow me to choose what the preset reaction time should be and update all calculations if it changes. What are your thoughts?

---

## Next Steps

- Find what unit of measurement for the angular measures is more appropriate for biomechanical analysis. What values do researchers like Ken Clarke and Peter Weyand find in their papers - especially the 'whip from the hip' paper about thigh angular velocity?
- The first ground contact won't have a stride value. I think we can get one by allowing it to be annotated using the start position as a reference (duh!)
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
