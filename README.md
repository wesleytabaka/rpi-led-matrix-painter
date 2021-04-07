# rpi-led-matrix-painter
Add drawing facilities to alexeden/rpi-led-matrix.  Takes a declarative approach to drawing on the matrix.  Manage sections of the board independently, draw shapes, text, images, and some simple effects.  Watch this space.  Check implementation branch for latest updates.
<br><br>For example, the below TypeScript can be used to produce what's seen in the photo below.<br>
<code><pre>
        const date: Date = new Date();
        const timeString: string = this.leadingZeroes(date.getHours(), 2) + ":" + this.leadingZeroes(date.getMinutes(), 2) + ":" + this.leadingZeroes(date.getSeconds(), 2) + "." + this.leadingZeroes(date.getMilliseconds(), 3);
        const dateString: string = date.getFullYear() + '-' + this.leadingZeroes(date.getMonth() + 1, 2) + '-' + this.leadingZeroes(date.getDate(), 2);
        this.getCanvas().getCanvasSection("status")?.setRepresentation([
            // Red "X"
            {
                drawMode: DrawMode.POLYGON,
                drawModeOptions: {color: 0x800000, fill: true},
                points: [
                    {x: 5, y: 16, z: 1},
                    {x: 7, y: 18, z: 1},
                    {x: 9, y: 16, z: 1},
                    {x: 10, y: 17, z: 1},
                    {x: 8, y: 19, z: 1},
                    {x: 10, y: 21, z: 1},
                    {x: 9, y: 22, z: 1},
                    {x: 7, y: 20, z: 1},
                    {x: 5, y: 22, z: 1},
                    {x: 4, y: 21, z: 1},
                    {x: 6, y: 19, z: 1},
                    {x: 4, y: 17, z: 1}
                ],
                layer: 5
            },
            // Check mark
            {
                drawMode: DrawMode.POLYGON,
                drawModeOptions: {color: 0x008000, fill: true, },
                points: [
                    {x: 13, y: 19, z: 1},
                    {x: 14, y: 20, z: 1},
                    {x: 18, y: 16, z: 1},
                    {x: 19, y: 17, z: 1},
                    {x: 14, y: 22, z: 1},
                    {x: 12, y: 20, z: 1}
                ],
                layer: 5
            },
            // Warning triangle
            {
                drawMode: DrawMode.POLYGON,
                drawModeOptions: {color: 0x805000, fill: true, },
                points: [
                    {x: 26, y: 16, z: 1},
                    {x: 30, y: 22, z: 1},
                    {x: 22, y: 22, z: 1}
                ],
                layer: 5
            },
            // Exclamation mark for warning triangle
            {
                drawMode: DrawMode.PIXEL,
                drawModeOptions: {color: 0x000000},
                points: [
                    {x: 26, y: 18, z: 1},
                    {x: 26, y: 19, z: 1},
                    {x: 26, y: 21, z: 1}
                ],
                layer: 5
            },
            // Draw the current time
            {
                drawMode: DrawMode.TEXT,
                drawModeOptions: {color: 0x800000, fill: true, font: "5x7", "fontPath": "/home/pi/code/rpi-led-matrix-painter/rpi-led-matrix-painter/rpi-led-matrix/fonts/5x7.bdf"},
                points: {x: 5, y:0, z: 1},
                text: timeString,
                layer: 5
            },
            // Draw the current date
            {
                drawMode: DrawMode.TEXT,
                drawModeOptions: {color: 0x800000, fill: false, font: "4x6", "fontPath": "/home/pi/code/rpi-led-matrix-painter/rpi-led-matrix-painter/rpi-led-matrix/fonts/4x6.bdf"},
                points: {x: 25, y: 8, z: 1},
                text: dateString,
                layer: 6
            }
           </pre></code>
           ![demo](/url "docs/demo.png")