# Development Log

TODO

- Add the feature to place markers (with optional labels) and then retroactively measure the distance between them
- The button to turn off all pose landmarks doesn't work
- Pose landmark is kinda slow from the server. Find a way to use GPU?
- When using the export option, let the draw box disappear after I close the panel.
- Switched to Movenet. Slightly more reliable than MediaPipe but still wildly inaccurate. Need to try something more accurate. If running a backend with Python is the cost then so be it. RTMPose or MMPose. I think they even have 3D versions? Could use that straight for the ThreeJS?
- Work on the telemetry section

## Backend

- Working decently and integrated into the frontend directory.

-
- Get the requirements necessary for the application. So that from the server, I can just install the requirements. Luckily its just RTMPose and FastAPI with their respective dependencies.
- Deploy to Fly.io because free tier is more generous and doesn't hibernate? Regardless can write code to warm up the server
-

## Documentation

- Need to find a way to get the Test Driven Development stuff done.
- Add a help section where we'll write some guides to help users. Will record a demo video and post on YouTube and link here. Will provide a download sample so users can test the platform without having their own sprint video. Can use modals to guide the user on what to do. Allow the user to turn off the modal for subsequent visits and store that in local storage but have the option to turn it back on so that it shows up every time they open the application.
- Use CoPilot to scan all the files and write documentation for every aspect of the codebase (especially the math parts. Let's make the equations be done in LaTEX). Then host the docs somewhere and link to it in the README.md
- Speaking of README.md. Let CoPilot scan the entire codebase and write a really good one.
- We can also create a contributing.md. As Chat/Claude for the things I can do that will make my project stand out.
- Work on my GitHub profile's README.md to make it better.
