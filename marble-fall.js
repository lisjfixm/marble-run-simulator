class BallCamera extends BABYLON.FreeCamera {
    constructor(game) {
        super("ball-camera", BABYLON.Vector3.Zero(), game.scene);
        this.game = game;
        this.sideViewRadius = 0.5;
        this.isActive = false;
        this.firstPersonMode = true;
        this.direction = BABYLON.Vector3.Right();
        this.up = BABYLON.Vector3.Up();
        this.layerMask = 0x0FFFFFFF;
        this.minZ = 0.01;
        this.maxZ = 25;
        this.rotationQuaternion = BABYLON.Quaternion.Identity();
    }
    async activate() {
        if (!this.isActive) {
            this.position.copyFrom(this.game.arcCamera.globalPosition);
            this.game.arcCamera.detachControl();
            await this.game.animateCurtainOpacity(1, 0.1);
            this.game.updateCameraLayer(true);
            this.isActive = true;
            await this.game.animateCurtainOpacity(0, 0.1);
        }
    }
    async deactivate() {
        await this.game.animateCurtainOpacity(1, 0.1);
        this.isActive = false;
        this.game.updateCameraLayer(false);
        await this.game.animateCurtainOpacity(0, 0.1);
        this.game.arcCamera.attachControl();
    }
    ballCameraUpdate(rawDT) {
        if (this.firstPersonMode) {
            this.firstPersonUpdate(rawDT);
        }
        else {
            this.sideViewUpdate(rawDT);
        }
    }
    sideViewUpdate(rawDT) {
        let ball = this.game.machine.balls[0];
        if (ball) {
            this.direction.copyFromFloats(0, -0.4, 1).normalize();
            let fPos = Nabu.Easing.smoothNSec(1 / rawDT, 2);
            let targetPos = ball.position.subtract(this.direction.scale(this.sideViewRadius));
            this.position.scaleInPlace(fPos).addInPlace(targetPos.scale(1 - fPos));
            let fRot = Nabu.Easing.smoothNSec(1 / rawDT, 3);
            let targetRot = Mummu.QuaternionFromZYAxis(ball.position.subtract(this.position), BABYLON.Axis.Y);
            BABYLON.Quaternion.SlerpToRef(this.rotationQuaternion, targetRot, fRot, this.rotationQuaternion);
        }
    }
    firstPersonUpdate(rawDT) {
        let altTimeFactor = Math.sqrt(this.game.timeFactor);
        let ball = this.game.machine.balls[0];
        if (ball) {
            let velocity = ball.visibleVelocity.clone();
            let fDir = Nabu.Easing.smoothNSec(1 / rawDT, 0.2 / altTimeFactor);
            let a = Mummu.Angle(velocity, this.direction);
            if (a > Math.PI * 0.999 && a < Math.PI * 1.001) {
                velocity = Mummu.Rotate(this.direction, this.up, Math.PI * 0.5);
            }
            if (velocity.length() > 0) {
                let flat = this.direction.clone();
                flat.y = 0;
                flat.normalize();
                let right = BABYLON.Vector3.Cross(BABYLON.Axis.Y, flat);
                let aHorizon = Mummu.AngleFromToAround(flat, velocity, right);
                if (Math.abs(aHorizon) > Math.PI * 0.5) {
                    Mummu.RotateInPlace(velocity, right, -aHorizon);
                }
                this.direction.scaleInPlace(fDir).addInPlace(velocity.scale(1 - fDir)).normalize();
            }
            let right = BABYLON.Vector3.Cross(BABYLON.Axis.Y, this.direction);
            BABYLON.Vector3.CrossToRef(this.direction, right, this.up);
            this.up.normalize();
            let fPos = Nabu.Easing.smoothNSec(1 / rawDT, 0.5 / altTimeFactor);
            let targetPos = ball.position.subtract(this.direction.scale(0.15)).add(this.up.scale(0.03));
            this.position.scaleInPlace(fPos).addInPlace(targetPos.scale(1 - fPos));
            let fRot = Nabu.Easing.smoothNSec(1 / rawDT, 0.5 / altTimeFactor);
            let targetRot = Mummu.QuaternionFromZYAxis(ball.position.subtract(this.position), this.up);
            BABYLON.Quaternion.SlerpToRef(this.rotationQuaternion, targetRot, fRot, this.rotationQuaternion);
        }
    }
}
var TutorialsList = [
    "simple",
    "rotate",
    "loop",
    "speed",
    "lift",
    "join",
    "split"
];
var ChallengeMode;
(function (ChallengeMode) {
    ChallengeMode[ChallengeMode["Tutorial"] = 0] = "Tutorial";
    ChallengeMode[ChallengeMode["Puzzle"] = 1] = "Puzzle";
    ChallengeMode[ChallengeMode["Parkour"] = 2] = "Parkour";
})(ChallengeMode || (ChallengeMode = {}));
class SkipButton {
    constructor(game, id) {
        this.game = game;
        this.hideTimout = 0;
        this.update = () => {
            let opacity = parseFloat(this.htmlButton.style.opacity);
            if (isNaN(opacity)) {
                opacity = 0;
            }
            opacity += 0.05;
            if (opacity >= 1) {
                this.htmlButton.style.opacity = "1";
                this.game.scene.onBeforeRenderObservable.removeCallback(this.update);
            }
            else {
                this.htmlButton.style.opacity = opacity.toFixed(2);
            }
        };
        this.htmlButton = document.getElementById("challenge-tuto-skip");
    }
    show() {
        clearTimeout(this.hideTimout);
        this.htmlButton.style.display = "block";
        this.game.scene.onBeforeRenderObservable.add(this.update);
    }
    hide() {
        this.hideTimout = setTimeout(() => {
            this.htmlButton.style.opacity = "0";
            this.htmlButton.style.display = "none";
            this.game.scene.onBeforeRenderObservable.removeCallback(this.update);
        }, 250);
    }
}
class ChallengeWinZone {
    constructor(min, max, materialIndex) {
        this.min = min;
        this.max = max;
        this.materialIndex = materialIndex;
    }
}
class Challenge {
    constructor(game) {
        this.game = game;
        this.WaitAnimation = Mummu.AnimationFactory.EmptyVoidCallback;
        //public tutorialNextButton: HTMLButtonElement;
        //public parkourNextButton: HTMLButtonElement;
        //public puzzleNextButton: HTMLButtonElement;
        //public tutorialGotoButton: HTMLButtonElement;
        //public parkourGotoButton: HTMLButtonElement;
        //public puzzleGotoButton: HTMLButtonElement;
        //public editorGotoButton: HTMLButtonElement;
        //public demoGotoButton: HTMLButtonElement;
        this.lastCompletedMode = ChallengeMode.Tutorial;
        this.mode = ChallengeMode.Tutorial;
        this.state = 0;
        this.lastStepRunned = 0;
        this.failure = false;
        this.delay = 4;
        this.steps = [];
        this.winzones = [];
        this.currentChallengeIndex = 0;
        this.availableElements = [];
        this.onBoostDown = () => {
            this.game.toolbar.onBoostDown();
        };
        this.onBoostUp = () => {
            this.game.toolbar.onBoostUp();
        };
        this._needRepeatTime = 0;
        this._successTime = 0;
        this.WaitAnimation = Mummu.AnimationFactory.CreateWait(this.game);
        this.helper = new ChallengeHelper(this);
        this.tutoPopup = document.getElementById("challenge-tuto");
        this.challengeText = this.tutoPopup.querySelector("div");
        this.tutoComplete = document.getElementById("challenge-next");
        this.skipButton = new SkipButton(this.game, "challenge-tuto-skip");
        //this.tutorialNextButton = document.getElementById("tutorial-next-button") as HTMLButtonElement;
        //this.parkourNextButton = document.getElementById("parkour-next-button") as HTMLButtonElement;
        //this.puzzleNextButton = document.getElementById("puzzle-next-button") as HTMLButtonElement;
        //this.tutorialGotoButton = document.getElementById("tutorial-goto-button") as HTMLButtonElement;
        //this.parkourGotoButton = document.getElementById("parkour-goto-button") as HTMLButtonElement;
        //this.puzzleGotoButton = document.getElementById("puzzle-goto-button") as HTMLButtonElement;
        //this.editorGotoButton = document.getElementById("editor-goto-button") as HTMLButtonElement;
        //this.demoGotoButton = document.getElementById("demo-goto-button") as HTMLButtonElement;
    }
    completeChallenge(mode, index) {
        console.log("complete challenge " + index);
        this.lastCompletedMode = mode;
        if (mode === ChallengeMode.Tutorial) {
            this.game.completedChallenges.tutorial[index] = 1;
        }
        else if (mode === ChallengeMode.Parkour) {
            this.game.completedChallenges.parkour[index - 1] = 1;
        }
        else if (mode === ChallengeMode.Puzzle) {
            this.game.completedChallenges.puzzle[index - 1] = 1;
        }
        if (HasLocalStorage) {
            window.localStorage.setItem("completed-challenges", JSON.stringify(this.game.completedChallenges));
        }
    }
    initialize(data) {
        if (typeof (data.index) === "number") {
            this.currentChallengeIndex = data.index;
        }
        else {
            this.currentChallengeIndex = TutorialsList.indexOf(data.index);
            this.game.machine.name = "Tutorial " + (this.currentChallengeIndex + 1).toFixed(0) + " / " + TutorialsList.length.toFixed(0);
        }
        this.steps = ChallengeStepsFactory.GetSteps(this, this.mode, data.index);
        this.onUpdate = ChallengeStepsFactory.GetOnUpdateCallback(this, this.mode, data.index);
        this._needRepeatTime = 0;
        this._successTime = 0;
        this.failure = false;
        this.helper.initialize(data.help);
        this.lastStepRunned = -1;
        this.state = 0;
        this.winzones = [];
        let arrivals = this.game.machine.parts.filter(part => { return part.partName === "end"; });
        arrivals.forEach(arrival => {
            if (arrival) {
                let p = new BABYLON.Vector3(0.03, Core.tileHeight * 0.5, 0);
                BABYLON.Vector3.TransformCoordinatesToRef(p, arrival.getWorldMatrix(), p);
                let winZoneMin = p.clone();
                winZoneMin.x -= 0.04;
                winZoneMin.y -= 0.03;
                winZoneMin.z -= 0.01;
                let winZoneMax = p.clone();
                winZoneMax.x += 0.04;
                winZoneMax.y += 0.03;
                winZoneMax.z += 0.01;
                let winZone = new ChallengeWinZone(winZoneMin, winZoneMax, -1);
                this.winzones.push(winZone);
            }
        });
        if (isFinite(data.camRadius)) {
            this.game.targetCamRadius = data.camRadius;
        }
        this.game.gridIMin = isFinite(data.gridIMin) ? data.gridIMin : -10;
        this.game.gridIMax = isFinite(data.gridIMax) ? data.gridIMax : 10;
        this.game.gridJMin = isFinite(data.gridJMin) ? data.gridJMin : -10;
        this.game.gridJMax = isFinite(data.gridJMax) ? data.gridJMax : 10;
        this.game.gridKMin = isFinite(data.gridKMin) ? data.gridKMin : 4;
        this.game.gridKMax = isFinite(data.gridKMax) ? data.gridKMax : 4;
        if (this.game.DEBUG_MODE) {
            this.game.machine.generateLimitsMesh();
        }
        this.game.inputManager.removeMappedKeyDownListener(KeyInput.BALL_BOOST, this.onBoostDown);
        this.game.inputManager.removeMappedKeyUpListener(KeyInput.BALL_BOOST, this.onBoostUp);
        if (this.mode === ChallengeMode.Parkour) {
            this.game.inputManager.addMappedKeyDownListener(KeyInput.BALL_BOOST, this.onBoostDown);
            this.game.inputManager.addMappedKeyUpListener(KeyInput.BALL_BOOST, this.onBoostUp);
            let ball = this.game.machine.balls[0];
            if (ball) {
                ball.useBoostingMaterial();
            }
        }
        document.getElementById("challenge-topbar").style.display = "block";
        document.getElementById("challenge-topbar-reset").onpointerdown = (e) => {
            e.preventDefault();
            this.reset();
        };
        document.getElementById("challenge-topbar-help").onpointerdown = (e) => {
            e.preventDefault();
            this.game.textHelpersManager.showChallengeHelperPopup();
        };
    }
    isInWinzone(ball) {
        for (let i = 0; i < this.winzones.length; i++) {
            let winzone = this.winzones[i];
            if (winzone.materialIndex === -1 || winzone.materialIndex === ball.materialIndex) {
                if (Mummu.SphereAABBCheck(ball.position, ball.radius, winzone.min, winzone.max)) {
                    return true;
                }
            }
        }
        return false;
    }
    start() {
        this.reset();
        this.game.machine.play();
        this.game.setCameraMode(CameraMode.SideViewBall);
        if (this.game.DEBUG_MODE) {
            this.helper.start();
        }
    }
    reset() {
        this.failure = false;
        this.game.machine.stop();
        if (this.mode === ChallengeMode.Tutorial || this.mode === ChallengeMode.Puzzle) {
            let i = 0;
            while (i < this.game.machine.parts.length) {
                let part = this.game.machine.parts[i];
                if (part.isSelectable) {
                    if (part.onBeforeDelete) {
                        part.onBeforeDelete();
                    }
                    part.dispose();
                }
                else {
                    i++;
                }
            }
        }
    }
    update(rawtDT) {
        this.helper.update(rawtDT);
        let showHelpButton = true;
        let showResetButton = true;
        if (this.state >= 100) {
            showResetButton = false;
            showHelpButton = false;
        }
        if (this.mode === ChallengeMode.Parkour) {
            if (this.game.machine.stopped) {
                showResetButton = false;
            }
        }
        if (this.mode === ChallengeMode.Tutorial || this.mode === ChallengeMode.Puzzle) {
            let addedPart = this.game.machine.parts.find(part => { return part.isSelectable; });
            if (!addedPart) {
                showResetButton = false;
            }
        }
        if (!this.helper.paths || this.helper.paths.length === 0) {
            showHelpButton = false;
        }
        if (this.helper.shown) {
            showHelpButton = false;
        }
        document.getElementById("challenge-topbar-help").setAttribute("status", showHelpButton ? "enabled" : "disabled");
        if (!showHelpButton) {
            if (this.game.textHelpersManager.challengeHelper.shown) {
                this.game.textHelpersManager.challengeHelper.hide();
            }
        }
        document.getElementById("challenge-topbar-reset").setAttribute("status", showResetButton ? "enabled" : "disabled");
        if (this.state < 100) {
            let ballsIn = true;
            for (let i = 0; i < this.game.machine.balls.length; i++) {
                let ball = this.game.machine.balls[i];
                ballsIn = ballsIn && ball && this.isInWinzone(ball);
            }
            if (ballsIn) {
                this._successTime += rawtDT;
            }
            else {
                this._successTime = 0;
            }
            if (this._successTime > 1) {
                this.state = 101;
            }
        }
        if (this.onUpdate) {
            this.onUpdate();
        }
        if (this.state != -1 && this.state < 100) {
            let next = this.state + 1;
            let prevConditionHolder = this.steps[this.state - 1];
            let stepConditionHolder = this.steps[this.state];
            let condition;
            let skipCondition;
            let noRepeat = false;
            if (prevConditionHolder instanceof ChallengeStep) {
                noRepeat = prevConditionHolder.noRepeat;
            }
            else if (prevConditionHolder) {
                noRepeat = prevConditionHolder[0].noRepeat;
            }
            if (stepConditionHolder instanceof ChallengeStep) {
                condition = stepConditionHolder.condition;
                skipCondition = stepConditionHolder.skipCondition;
            }
            else if (stepConditionHolder) {
                condition = stepConditionHolder[0].condition;
                skipCondition = stepConditionHolder[0].skipCondition;
            }
            if (!condition || condition(this)) {
                if (skipCondition && skipCondition(this)) {
                    this.state = next;
                }
                else {
                    let step = this.steps[this.state];
                    if (step instanceof ChallengeStep) {
                        this._needRepeatTime = 0;
                        this.lastStepRunned = this.state;
                        this.state = -1;
                        step.doStep().then(() => {
                            this.skipButton.hide();
                            this.state = next;
                        });
                        this.skipButton.show();
                        this.skipButton.htmlButton.onclick = () => {
                            step.doSkip();
                        };
                    }
                    else if (step) {
                        this._needRepeatTime = 0;
                        let steps = step;
                        let count = steps.length;
                        this.lastStepRunned = this.state;
                        this.state = -1;
                        for (let i = 0; i < steps.length; i++) {
                            steps[i].doStep().then(() => {
                                count--;
                            });
                        }
                        this.skipButton.show();
                        this.skipButton.htmlButton.onclick = () => {
                            for (let i = 0; i < steps.length; i++) {
                                steps[i].doSkip();
                            }
                        };
                        let checkAllDone = setInterval(() => {
                            if (count === 0) {
                                this.skipButton.hide();
                                this.state = next;
                                clearInterval(checkAllDone);
                            }
                        }, 15);
                    }
                }
            }
            else {
                if (!noRepeat) {
                    this._needRepeatTime += rawtDT;
                    if (this._needRepeatTime > 2 * this.delay) {
                        this._needRepeatTime = 0;
                        this.state--;
                    }
                }
            }
        }
        else if (this.state > 100) {
            if (this.game.DEBUG_MODE) {
                this.helper.DEBUG_logRecordedPaths();
            }
            this.helper.hide();
            this.state = 100;
            this.game.toolbar.updateButtonsVisibility();
            let doFinalStep = async () => {
                this.game.machineEditor.inputEnabled = false;
                if (this.mode === ChallengeMode.Tutorial) {
                    this.challengeText.innerHTML = '<i18n-text text-key="tutorial-completed"></i18n-text>';
                    this.tutoPopup.setAttribute("color", "orange");
                }
                else if (this.mode === ChallengeMode.Parkour) {
                    this.challengeText.innerHTML = '<i18n-text text-key="parkour-completed"></i18n-text>';
                    this.tutoPopup.setAttribute("color", "orange");
                }
                else if (this.mode === ChallengeMode.Puzzle) {
                    this.challengeText.innerHTML = '<i18n-text text-key="puzzle-completed"></i18n-text>';
                    this.tutoPopup.setAttribute("color", "orange");
                }
                //this.setChallengeNextPopupLayout();
                this.tutoPopup.setAttribute("duration", "0");
                this.completeChallenge(this.mode, this.currentChallengeIndex);
                this.tutoPopup.show(0.3);
                await this.WaitAnimation(1);
                if (this.game.mode === GameMode.Challenge && this.state === 100) {
                    this.tutoComplete.querySelector("button").innerHTML = '<i18n-text text-key="challenge-next-' + Math.floor(5).toFixed(0) + '"></i18n-text>';
                    await this.tutoComplete.show(0.3);
                }
            };
            doFinalStep();
        }
    }
}
class ChallengeHelper {
    constructor(challenge) {
        this.challenge = challenge;
        this.meshes = [];
        this.DEBUG_recordedPaths = [[]];
        this.paths = [];
    }
    DEBUG_resetRecord() {
        this.DEBUG_recordedPaths = [[]];
    }
    DEBUG_logRecordedPaths() {
        if (this.DEBUG_logRecordedPaths) {
        }
        let cleanPaths = [];
        for (let i = 0; i < this.DEBUG_recordedPaths.length; i++) {
            let recordedPath = this.DEBUG_recordedPaths[i];
            if (recordedPath.length >= 2) {
                recordedPath = [...recordedPath];
                Mummu.DecimatePathInPlaceFast(recordedPath, (3 / 180) * Math.PI);
                let cleanPath = [];
                for (let j = 0; j < recordedPath.length; j++) {
                    cleanPath.push(Math.round(recordedPath[j].x * 1000), Math.round(recordedPath[j].y * 1000), Math.round(recordedPath[j].z * 1000));
                }
                cleanPaths.push(cleanPath);
            }
        }
        console.log(cleanPaths);
    }
    DEBUG_logPuzzleSolution() {
        let cleanPaths = [];
        this.challenge.game.machine.parts.forEach(part => {
            if (part.isSelectable) {
                part.tracks.forEach(track => {
                    let path = track.templateInterpolatedPoints.map(p => { return BABYLON.Vector3.TransformCoordinates(p, part.getWorldMatrix()); });
                    Mummu.DecimatePathInPlaceFast(path, (3 / 180) * Math.PI);
                    let cleanPath = [];
                    for (let j = 0; j < path.length; j++) {
                        cleanPath.push(Math.round(path[j].x * 1000), Math.round(path[j].y * 1000), Math.round(path[j].z * 1000));
                    }
                    cleanPaths.push(cleanPath);
                });
            }
        });
        console.log(cleanPaths);
    }
    initialize(serializedPaths) {
        this.paths = [];
        if (serializedPaths && isFinite(serializedPaths.length)) {
            for (let i = 0; i < serializedPaths.length; i++) {
                let serializedPath = serializedPaths[i];
                if (serializedPath) {
                    let path = [];
                    for (let j = 0; j < serializedPath.length / 3; j++) {
                        let x = serializedPath[3 * j] / 1000;
                        let y = serializedPath[3 * j + 1] / 1000;
                        let z = serializedPath[3 * j + 2] / 1000;
                        path.push(new BABYLON.Vector3(x, y, z));
                    }
                    Mummu.SmoothPathInPlace(path, 0.3);
                    this.paths.push(path);
                }
            }
        }
    }
    get shown() {
        return this.meshes.length > 0;
    }
    show() {
        this.hide();
        if (this.challenge.mode === ChallengeMode.Parkour) {
            let w2 = 0.007;
            let h2 = 0.001;
            let shape = [
                new BABYLON.Vector3(w2, h2, 0),
                new BABYLON.Vector3(-w2, h2, 0),
                new BABYLON.Vector3(-w2, -h2, 0),
                new BABYLON.Vector3(w2, -h2, 0),
                new BABYLON.Vector3(w2, h2, 0)
            ];
            for (let i = 0; i < this.paths.length; i++) {
                let path = this.paths[i];
                let mesh = BABYLON.MeshBuilder.ExtrudeShape("test", { shape: shape, path: path });
                //let data = BABYLON.VertexData.ExtractFromMesh(mesh);
                //let c = i / (this.paths.length - 1);
                //Mummu.ColorizeVertexDataInPlace(data, new BABYLON.Color3(c, c, c));
                //data.applyToMesh(mesh);
                mesh.material = this.challenge.game.materials.ballAnimationMaterial;
                mesh.position.y -= 0.003;
                this.meshes.push(mesh);
            }
        }
        if (this.challenge.mode === ChallengeMode.Tutorial || this.challenge.mode === ChallengeMode.Puzzle) {
            let w2 = 0.0015;
            let h2 = 0.0015;
            let shape = [
                new BABYLON.Vector3(w2, h2, 0),
                new BABYLON.Vector3(-w2, h2, 0),
                new BABYLON.Vector3(-w2, -h2, 0),
                new BABYLON.Vector3(w2, -h2, 0),
                new BABYLON.Vector3(w2, h2, 0)
            ];
            for (let i = 0; i < this.paths.length; i++) {
                let path = this.paths[i];
                let mesh = BABYLON.MeshBuilder.ExtrudeShape("test", { shape: shape, path: path });
                mesh.visibility = 0.4;
                mesh.material = this.challenge.game.materials.cyanMaterial;
                this.meshes.push(mesh);
            }
        }
    }
    hide() {
        while (this.meshes.length > 0) {
            this.meshes.pop().dispose();
        }
    }
    start() {
        if (this.challenge.game.DEBUG_MODE) {
            this.DEBUG_resetRecord();
        }
    }
    update(rawDT) {
        if (this.challenge.game.DEBUG_MODE) {
            if (this.challenge.mode === ChallengeMode.Parkour || true) {
                if (this.challenge.game.machine.playing) {
                    let ball = this.challenge.game.machine.balls[0];
                    if (ball) {
                        let lastPath = this.DEBUG_recordedPaths[this.DEBUG_recordedPaths.length - 1];
                        if (ball.boosting || true) {
                            let pos = ball.position;
                            let lastPos = lastPath[lastPath.length - 1];
                            if (!lastPos || BABYLON.Vector3.Distance(pos, lastPos) > 0.005) {
                                lastPath.push(pos.clone());
                            }
                        }
                        else {
                            if (lastPath.length > 0) {
                                let pos = ball.position;
                                lastPath.push(pos.clone());
                                this.DEBUG_recordedPaths.push([]);
                            }
                        }
                    }
                }
            }
        }
    }
}
class ChallengeStep {
    constructor(challenge) {
        this.challenge = challenge;
        this.noRepeat = false;
        this.skipable = true;
    }
    static Action(challenge, callback) {
        let step = new ChallengeStep(challenge);
        step.skipable = false;
        let skipped = false;
        let skipResolve;
        step.doStep = () => {
            skipped = false;
            return new Promise(async (resolve) => {
                skipResolve = resolve;
                callback();
                if (skipped) {
                    return;
                }
                resolve();
            });
        };
        step.doSkip = () => {
            if (skipResolve) {
                skipResolve();
            }
            skipped = true;
        };
        return step;
    }
    static Wait(challenge, duration) {
        let step = new ChallengeStep(challenge);
        step.skipable = false;
        let skipped = false;
        let skipResolve;
        step.doStep = () => {
            skipped = false;
            return new Promise(async (resolve) => {
                skipResolve = resolve;
                await challenge.WaitAnimation(duration);
                if (skipped) {
                    return;
                }
                resolve();
            });
        };
        step.doSkip = () => {
            if (skipResolve) {
                skipResolve();
            }
            skipped = true;
        };
        return step;
    }
    static Path(challenge, path, duration) {
        let step = new ChallengeStep(challenge);
        let ballGhostMesh;
        let pathMesh;
        let skipped = false;
        let skipResolve;
        step.doStep = async () => {
            skipped = false;
            return new Promise(async (resolve) => {
                skipResolve = resolve;
                let points = [];
                for (let i = 0; i < path.length / 3; i++) {
                    points.push(new BABYLON.Vector3(path[3 * i] / 1000, path[3 * i + 1] / 1000, path[3 * i + 2] / 1000));
                }
                Mummu.SmoothPathInPlace(points, 0.5);
                Mummu.CatmullRomPathInPlace(points);
                ballGhostMesh = BABYLON.MeshBuilder.CreateSphere("ballghost-mesh", { segments: 10, diameter: 0.016 });
                ballGhostMesh.visibility = 0.2;
                ballGhostMesh.material = challenge.game.materials.whiteFullLitMaterial;
                let data = Mummu.CreateWireVertexData({ path: points, radius: 0.003, color: new BABYLON.Color4(0, 1, 1, 1), textureRatio: 4, pathUps: points.map(p => { return BABYLON.Vector3.Up(); }) });
                pathMesh = new BABYLON.Mesh("path-mesh");
                pathMesh.material = challenge.game.materials.whiteFullLitMaterial;
                pathMesh.visibility = 0.2;
                data.applyToMesh(pathMesh);
                let t0 = performance.now();
                let update = () => {
                    let t = (performance.now() - t0) / 1000;
                    if (t < duration && !skipped && !pathMesh.isDisposed() && !ballGhostMesh.isDisposed()) {
                        let fPath = 1;
                        if (t < 0.3) {
                            fPath = t / 0.3;
                        }
                        else if (t > duration - 0.3) {
                            fPath = 1 - (t - (duration - 0.3)) / 0.3;
                        }
                        pathMesh.visibility = 0.2 * fPath;
                        let f = t / duration;
                        let p = points[Math.floor(f * points.length)];
                        ballGhostMesh.position.scaleInPlace(0.9).addInPlace(p.scale(0.1));
                        requestAnimationFrame(update);
                    }
                };
                update();
                await challenge.WaitAnimation(duration);
                if (skipped) {
                    return;
                }
                ballGhostMesh.dispose();
                pathMesh.dispose();
                resolve();
            });
        };
        step.doSkip = () => {
            if (ballGhostMesh) {
                ballGhostMesh.dispose();
            }
            if (pathMesh) {
                pathMesh.dispose();
            }
            if (skipResolve) {
                skipResolve();
            }
            skipped = true;
        };
        return step;
    }
    static Text(challenge, text, duration) {
        let step = new ChallengeStep(challenge);
        let skipped = false;
        let skipResolve;
        step.doStep = async () => {
            skipped = false;
            step.challenge.tutoPopup.setAttribute("duration", "0");
            step.challenge.challengeText.innerHTML = text;
            step.challenge.tutoPopup.setAttribute("color", "");
            return new Promise(async (resolve) => {
                skipResolve = resolve;
                await step.challenge.tutoPopup.show(0.3);
                if (skipped) {
                    return;
                }
                await challenge.WaitAnimation(duration - 0.6);
                if (skipped) {
                    return;
                }
                await step.challenge.tutoPopup.hide(0.3);
                resolve();
            });
        };
        step.doSkip = () => {
            step.challenge.tutoPopup.hide(0);
            if (skipResolve) {
                skipResolve();
            }
            skipped = true;
        };
        return step;
    }
    static Arrow(challenge, position, duration) {
        let step = new ChallengeStep(challenge);
        let arrow;
        let skipped = false;
        let skipResolve;
        step.doStep = () => {
            skipped = false;
            let p;
            if (position instanceof BABYLON.Vector3) {
                p = position;
            }
            else {
                p = position();
            }
            let dir = new BABYLON.Vector3(0, -1, 0);
            arrow = new HighlightArrow("challenge-step-arrow", challenge.game, 0.05, 0.002, dir);
            arrow.position = p;
            return new Promise(resolve => {
                skipResolve = resolve;
                arrow.instantiate().then(async () => {
                    if (skipped) {
                        return;
                    }
                    await arrow.show(0.3);
                    if (skipped) {
                        return;
                    }
                    await challenge.WaitAnimation(duration - 0.6);
                    if (skipped) {
                        return;
                    }
                    await arrow.hide(0.3);
                    if (skipped) {
                        return;
                    }
                    arrow.dispose();
                    resolve();
                });
            });
        };
        step.doSkip = () => {
            arrow.dispose();
            if (skipResolve) {
                skipResolve();
            }
            skipped = true;
        };
        return step;
    }
    static ArrowSlide(challenge, from, dirFrom, to, dirTo, duration) {
        let step = new ChallengeStep(challenge);
        let arrow;
        let skipped = false;
        let skipResolve;
        step.doStep = () => {
            skipped = false;
            let p;
            if (from instanceof BABYLON.Vector3) {
                p = from;
            }
            else {
                p = from();
            }
            arrow = new HighlightArrow("challenge-step-arrow", challenge.game, 0.05, 0.002, dirFrom);
            arrow.position = p;
            return new Promise(resolve => {
                skipResolve = resolve;
                arrow.instantiate().then(async () => {
                    if (skipped) {
                        return;
                    }
                    await arrow.show(0.3);
                    if (skipped) {
                        return;
                    }
                    if (to instanceof BABYLON.Vector3) {
                        p = to;
                    }
                    else {
                        p = to();
                    }
                    await arrow.slide(p, dirTo, duration - 0.6, Nabu.Easing.easeInOutSine);
                    if (skipped) {
                        return;
                    }
                    await arrow.hide(0.3);
                    if (skipped) {
                        return;
                    }
                    arrow.dispose();
                    resolve();
                });
            });
        };
        step.doSkip = () => {
            arrow.dispose();
            if (skipResolve) {
                skipResolve();
            }
            skipped = true;
        };
        return step;
    }
    static SvgArrow(challenge, element, dir, duration) {
        let step = new ChallengeStep(challenge);
        let arrow;
        let skipped = false;
        let skipResolve;
        step.doStep = () => {
            skipped = false;
            arrow = new SvgArrow("challenge-step-arrow", challenge.game, 0.3, 0.15, dir);
            return new Promise(resolve => {
                skipResolve = resolve;
                arrow.instantiate().then(async () => {
                    if (skipped) {
                        return;
                    }
                    if (element instanceof HTMLElement) {
                        arrow.setTarget(element);
                    }
                    else {
                        arrow.setTarget(element());
                    }
                    await arrow.show(0.3);
                    if (skipped) {
                        return;
                    }
                    await challenge.WaitAnimation(duration - 0.6);
                    if (skipped) {
                        return;
                    }
                    await arrow.hide(0.3);
                    if (skipped) {
                        return;
                    }
                    arrow.dispose();
                    resolve();
                });
            });
        };
        step.doSkip = () => {
            arrow.dispose();
            if (skipResolve) {
                skipResolve();
            }
            skipped = true;
        };
        return step;
    }
    static SvgArrowSlide(challenge, originElement, origin, target, duration) {
        let step = new ChallengeStep(challenge);
        let arrow;
        let skipped = false;
        let skipResolve;
        step.doStep = () => {
            skipped = false;
            arrow = new SvgArrow("challenge-step-arrow", challenge.game, 0.3, 0.1, -45);
            return new Promise(resolve => {
                skipResolve = resolve;
                arrow.instantiate().then(async () => {
                    if (skipped) {
                        return;
                    }
                    if (origin) {
                        let xy = origin.xy();
                        arrow.setTargetXY(xy.x, xy.y);
                    }
                    else {
                        if (originElement instanceof HTMLElement) {
                            arrow.setTarget(originElement);
                        }
                        else {
                            arrow.setTarget(originElement());
                        }
                    }
                    await arrow.show(0.3);
                    if (skipped) {
                        return;
                    }
                    await arrow.slide(target.x(), target.y(), target.dir, duration - 0.6, Nabu.Easing.easeInOutSine);
                    if (skipped) {
                        return;
                    }
                    await arrow.hide(0.3);
                    if (skipped) {
                        return;
                    }
                    arrow.dispose();
                    resolve();
                });
            });
        };
        step.doSkip = () => {
            arrow.hide();
            arrow.dispose();
            if (skipResolve) {
                skipResolve();
            }
            skipped = true;
        };
        return step;
    }
    static ShowEndpoints(challenge, duration) {
        let step = new ChallengeStep(challenge);
        let skipped = false;
        let skipResolve;
        step.doStep = () => {
            skipped = false;
            return new Promise(async (resolve) => {
                skipResolve = resolve;
                challenge.game.machineEditor.endpointGizmoManager.showAvailableEndpoints = true;
                await challenge.WaitAnimation(duration);
                if (skipped) {
                    return;
                }
                challenge.game.machineEditor.endpointGizmoManager.showAvailableEndpoints = false;
                resolve();
            });
        };
        step.doSkip = () => {
            if (skipResolve) {
                skipResolve();
            }
            challenge.game.machineEditor.endpointGizmoManager.showAvailableEndpoints = false;
            skipped = true;
        };
        return step;
    }
}
class ChallengeStepsFactory {
    static MakeHasMachinePartCondition(partName, i, j, k, r) {
        return (challenge) => {
            let parts = challenge.game.machine.parts.filter((p) => {
                return p.partName.startsWith(partName);
            });
            for (let n = 0; n < parts.length; n++) {
                let part = parts[n];
                if (part) {
                    if (isNaN(i) || part.i === i) {
                        if (isNaN(j) || part.j === j) {
                            if (isNaN(k) || part.k === k) {
                                if (isNaN(r) || part.r === r) {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
            return false;
        };
    }
    static GetSteps(challenge, mode, index) {
        let steps = [];
        if (mode === ChallengeMode.Tutorial) {
            if (index === "simple") {
                steps[0] = [
                    ChallengeStep.Wait(challenge, challenge.delay * 0.3),
                    ChallengeStep.Action(challenge, () => {
                        challenge.game.toolbar.disablePlayStop();
                    }),
                ];
                steps[1] = ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-simple-step-0"></i18n-text>', challenge.delay * 0.8);
                steps[2] = ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-simple-title"></i18n-text> - <i18n-text text-key="tutorial-simple-subtitle"></i18n-text>', challenge.delay * 0.8);
                steps[3] = [
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-simple-step-1"></i18n-text>', challenge.delay * 1.5),
                    ChallengeStep.Path(challenge, [
                        -123, 84, 0,
                        -107, 82, 0,
                        -97, 81, 0,
                        -56, 80, 0,
                        -45, 79, 0,
                        -34, 77, 0,
                        38, 58, 0,
                        52, 56, 0,
                        67, 55, 0,
                        75, 54, 0,
                        83, 53, 0,
                        91, 50, 0,
                        98, 46, 0,
                        104, 44, 0,
                        114, 38, 0,
                        124, 30, 0,
                        134, 19, 0
                    ], challenge.delay * 1.2),
                    ChallengeStep.ShowEndpoints(challenge, challenge.delay * 1.5),
                ];
                steps[4] = [
                    ChallengeStep.SvgArrowSlide(challenge, () => {
                        return document.querySelector(".machine-editor-item");
                    }, undefined, {
                        x: () => {
                            return window.innerWidth * 0.5;
                        },
                        y: () => {
                            return window.innerHeight * 0.5;
                        },
                        dir: -135,
                    }, challenge.delay),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-simple-step-2"></i18n-text>', challenge.delay),
                    ChallengeStep.ShowEndpoints(challenge, challenge.delay),
                ];
                steps[5] = [ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-simple-step-3"></i18n-text>', challenge.delay), ChallengeStep.ShowEndpoints(challenge, challenge.delay)];
                steps[5][0].condition = (challenge) => {
                    return challenge.game.machine.parts.length > 2;
                };
                steps[6] = [
                    ChallengeStep.Action(challenge, () => {
                        challenge.game.toolbar.enablePlayStop();
                    }),
                    ChallengeStep.SvgArrow(challenge, () => {
                        return document.querySelector("#toolbar-play");
                    }, -155, challenge.delay),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-play-to-run"></i18n-text>', challenge.delay * 0.8),
                ];
                steps[6][0].condition = ChallengeStepsFactory.MakeHasMachinePartCondition("ramp", -2, 0, 3);
                steps[7] = ChallengeStep.Wait(challenge, challenge.delay * 0.1);
                steps[7].condition = (challenge) => {
                    return challenge.game.machine.playing;
                };
            }
            else if (index === "rotate") {
                steps[0] = [
                    ChallengeStep.Wait(challenge, challenge.delay * 0.3),
                    ChallengeStep.Action(challenge, () => {
                        challenge.game.toolbar.disablePlayStop();
                    }),
                ];
                steps[1] = ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-rotate-title"></i18n-text> - <i18n-text text-key="tutorial-rotate-subtitle"></i18n-text>', challenge.delay * 0.8);
                steps[2] = [
                    ChallengeStep.SvgArrowSlide(challenge, () => {
                        return document.querySelector(".machine-editor-item");
                    }, undefined, {
                        x: () => {
                            return window.innerWidth * 0.5;
                        },
                        y: () => {
                            return window.innerHeight * 0.5;
                        },
                        dir: -135,
                    }, challenge.delay * 0.8),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-rotate-step-0"></i18n-text>', challenge.delay),
                    ChallengeStep.ShowEndpoints(challenge, challenge.delay),
                ];
                steps[3] = [ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-rotate-step-1"></i18n-text>', challenge.delay), ChallengeStep.ShowEndpoints(challenge, challenge.delay)];
                steps[3][0].condition = (challenge) => {
                    return challenge.game.machine.parts.length >= 7;
                };
                steps[4] = [
                    ChallengeStep.Action(challenge, () => {
                        challenge.game.toolbar.enablePlayStop();
                    }),
                    ChallengeStep.SvgArrow(challenge, () => {
                        return document.querySelector("#toolbar-play");
                    }, -155, challenge.delay * 0.8),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-play-to-run"></i18n-text>', challenge.delay * 0.8),
                ];
                let cond1 = ChallengeStepsFactory.MakeHasMachinePartCondition("uturnsharp", 5, 0, 8, 0);
                let cond2 = ChallengeStepsFactory.MakeHasMachinePartCondition("uturnsharp", -5, 0, 3, 2);
                steps[4][0].condition = (challenge) => {
                    return cond1(challenge) && cond2(challenge);
                };
                steps[3][0].skipCondition = steps[4][0].condition;
                steps[5] = ChallengeStep.Wait(challenge, challenge.delay * 0.1);
                steps[5].condition = (challenge) => {
                    return challenge.game.machine.playing;
                };
            }
            else if (index === "speed") {
                steps[0] = [
                    ChallengeStep.Wait(challenge, challenge.delay * 0.3),
                    ChallengeStep.Action(challenge, () => {
                        challenge.game.toolbar.disablePlayStop();
                    }),
                ];
                steps[1] = ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-speed-title"></i18n-text> - <i18n-text text-key="tutorial-speed-subtitle"></i18n-text>', challenge.delay * 0.8);
                steps[2] = [ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-speed-step-0"></i18n-text>', challenge.delay)];
                steps[3] = [
                    ChallengeStep.SvgArrowSlide(challenge, () => {
                        return document.querySelector(".machine-editor-item");
                    }, undefined, {
                        x: () => {
                            return window.innerWidth * 0.5;
                        },
                        y: () => {
                            return window.innerHeight * 0.5;
                        },
                        dir: -135,
                    }, challenge.delay * 0.8),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-speed-step-1"></i18n-text>', challenge.delay),
                    ChallengeStep.ShowEndpoints(challenge, challenge.delay),
                ];
                steps[4] = [
                    ChallengeStep.Action(challenge, () => {
                        challenge.game.toolbar.enablePlayStop();
                    }),
                    ChallengeStep.SvgArrow(challenge, () => {
                        return document.querySelector("#toolbar-play");
                    }, -155, challenge.delay * 0.8),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-play-to-run"></i18n-text>', challenge.delay * 0.8),
                ];
                steps[4][0].condition = (challenge) => {
                    return challenge.game.machine.parts.length >= 10;
                };
                steps[3][0].skipCondition = steps[4][0].condition;
                steps[5] = ChallengeStep.Wait(challenge, challenge.delay * 0.1);
                steps[5].condition = (challenge) => {
                    return challenge.game.machine.playing;
                };
                steps[6] = [ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-speed-step-2"></i18n-text>', challenge.delay * 0.8)];
                steps[6][0].condition = (challenge) => {
                    let ball = challenge.game.machine.balls[0];
                    return ball.position.y < 0.01;
                };
                steps[7] = [
                    ChallengeStep.SvgArrow(challenge, () => {
                        return document.querySelector("#challenge-topbar-reset");
                    }, 35, challenge.delay * 0.8),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-speed-step-3"></i18n-text>', challenge.delay * 0.8),
                ];
                steps[7][0].noRepeat = true;
            }
            else if (index === "lift") {
                steps[0] = [
                    ChallengeStep.Wait(challenge, challenge.delay * 0.3),
                    ChallengeStep.Action(challenge, () => {
                        challenge.game.toolbar.disablePlayStop();
                    }),
                ];
                steps[1] = ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-lift-title"></i18n-text> - <i18n-text text-key="tutorial-lift-subtitle"></i18n-text>', challenge.delay * 0.8);
                steps[2] = [
                    ChallengeStep.SvgArrowSlide(challenge, () => {
                        return document.querySelector(".machine-editor-item");
                    }, undefined, {
                        x: () => {
                            return window.innerWidth * 0.5;
                        },
                        y: () => {
                            return window.innerHeight * 0.5;
                        },
                        dir: -135,
                    }, challenge.delay * 0.8),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-lift-step-0"></i18n-text>', challenge.delay),
                    ChallengeStep.ShowEndpoints(challenge, challenge.delay),
                ];
                steps[3] = [ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-lift-step-1"></i18n-text>', challenge.delay), ChallengeStep.ShowEndpoints(challenge, challenge.delay)];
                steps[3][0].condition = (challenge) => {
                    return challenge.game.machine.parts.length >= 7;
                };
                steps[4] = [
                    ChallengeStep.ArrowSlide(challenge, () => {
                        let shooter = challenge.game.machine.parts.find((p) => {
                            return p.partName.startsWith("shooter_");
                        });
                        if (shooter) {
                            let endPoint = shooter.endPoints.find((ep) => {
                                return !ep.connectedEndPoint;
                            });
                            if (endPoint) {
                                return endPoint.absolutePosition.clone();
                            }
                        }
                        return BABYLON.Vector3.Zero();
                    }, BABYLON.Vector3.Left(), () => {
                        let shooter = challenge.game.machine.parts.find((p) => {
                            return p.partName.startsWith("shooter_");
                        });
                        if (shooter) {
                            let endPoint = shooter.endPoints.find((ep) => {
                                return !ep.connectedEndPoint;
                            });
                            if (endPoint) {
                                if (endPoint.upperSide) {
                                    return new BABYLON.Vector3(0.1125, 0.12, 0);
                                }
                                else {
                                    return new BABYLON.Vector3(0.1125, -0.03, 0);
                                }
                            }
                        }
                        return BABYLON.Vector3.Zero();
                    }, new BABYLON.Vector3(-1, -1, 0).normalize(), challenge.delay),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-lift-step-2"></i18n-text>', challenge.delay),
                    ChallengeStep.ShowEndpoints(challenge, challenge.delay),
                ];
                steps[4][0].condition = ChallengeStepsFactory.MakeHasMachinePartCondition("shooter_9");
                steps[3][0].skipCondition = steps[4][0].condition;
                steps[5] = [
                    ChallengeStep.Action(challenge, () => {
                        challenge.game.toolbar.enablePlayStop();
                    }),
                    ChallengeStep.SvgArrow(challenge, () => {
                        return document.querySelector("#toolbar-play");
                    }, -155, challenge.delay * 0.8),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-play-to-run"></i18n-text>', challenge.delay * 0.8),
                ];
                steps[5][0].condition = ChallengeStepsFactory.MakeHasMachinePartCondition("shooter_9", -5, 0, 2, 2);
                steps[4][0].skipCondition = steps[5][0].condition;
                steps[6] = ChallengeStep.Wait(challenge, challenge.delay * 0.1);
                steps[6].condition = (challenge) => {
                    return challenge.game.machine.playing;
                };
            }
            else if (index === "join") {
                steps[0] = [
                    ChallengeStep.Wait(challenge, challenge.delay * 0.3),
                    ChallengeStep.Action(challenge, () => {
                        challenge.game.toolbar.disablePlayStop();
                    }),
                ];
                steps[1] = ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-join-title"></i18n-text> - <i18n-text text-key="tutorial-join-subtitle"></i18n-text>', challenge.delay * 0.8);
                steps[2] = ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-join-step-0"></i18n-text>', challenge.delay);
                steps[3] = [
                    ChallengeStep.SvgArrowSlide(challenge, () => {
                        return document.querySelector(".machine-editor-item");
                    }, undefined, {
                        x: () => {
                            return window.innerWidth * 0.5;
                        },
                        y: () => {
                            return window.innerHeight * 0.5;
                        },
                        dir: -135,
                    }, challenge.delay * 0.8),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-join-step-1"></i18n-text>', challenge.delay),
                    ChallengeStep.ShowEndpoints(challenge, challenge.delay),
                ];
                steps[4] = [ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-join-step-2"></i18n-text>', challenge.delay), ChallengeStep.ShowEndpoints(challenge, challenge.delay)];
                steps[4][0].condition = (challenge) => {
                    return challenge.game.machine.parts.length >= 12;
                };
                steps[3][0].skipCondition = steps[4][0].condition;
                steps[5] = [
                    ChallengeStep.Action(challenge, () => {
                        challenge.game.toolbar.enablePlayStop();
                    }),
                    ChallengeStep.SvgArrow(challenge, () => {
                        return document.querySelector("#toolbar-play");
                    }, -155, challenge.delay * 0.8),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-play-to-run"></i18n-text>', challenge.delay * 0.8),
                ];
                let cond1 = ChallengeStepsFactory.MakeHasMachinePartCondition("join", 0, 0, 3, 0);
                let cond2 = ChallengeStepsFactory.MakeHasMachinePartCondition("flatjoin", 8, 0, 5, 2);
                steps[5][0].condition = (challenge) => {
                    return cond1(challenge) && cond2(challenge);
                };
                steps[4][0].skipCondition = steps[5][0].condition;
                steps[6] = ChallengeStep.Wait(challenge, challenge.delay * 0.1);
                steps[6].condition = (challenge) => {
                    return challenge.game.machine.playing;
                };
            }
            else if (index === "split") {
                steps[0] = [
                    ChallengeStep.Wait(challenge, challenge.delay * 0.3),
                    ChallengeStep.Action(challenge, () => {
                        challenge.game.toolbar.disablePlayStop();
                    }),
                ];
                steps[1] = ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-split-title"></i18n-text> - <i18n-text text-key="tutorial-split-subtitle"></i18n-text>', challenge.delay * 0.8);
                steps[2] = ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-split-step-0"></i18n-text>', challenge.delay);
                steps[3] = [
                    ChallengeStep.SvgArrowSlide(challenge, () => {
                        return document.querySelector(".machine-editor-item");
                    }, undefined, {
                        x: () => {
                            return window.innerWidth * 0.5;
                        },
                        y: () => {
                            return window.innerHeight * 0.5;
                        },
                        dir: -135,
                    }, challenge.delay * 0.8),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-split-step-1"></i18n-text>', challenge.delay),
                    ChallengeStep.ShowEndpoints(challenge, challenge.delay),
                ];
                steps[4] = [
                    ChallengeStep.Action(challenge, () => {
                        challenge.game.toolbar.enablePlayStop();
                    }),
                    ChallengeStep.SvgArrow(challenge, () => {
                        return document.querySelector("#toolbar-play");
                    }, -155, challenge.delay * 0.8),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-play-to-run"></i18n-text>', challenge.delay * 0.8),
                ];
                steps[4][0].condition = (challenge) => {
                    return challenge.game.machine.parts.length >= 10;
                };
                steps[3][0].skipCondition = steps[4][0].condition;
                steps[5] = ChallengeStep.Wait(challenge, challenge.delay * 0.1);
                steps[5].condition = (challenge) => {
                    return challenge.game.machine.playing;
                };
            }
            else if (index === "loop") {
                steps[0] = [
                    ChallengeStep.Wait(challenge, challenge.delay * 0.3),
                    ChallengeStep.Action(challenge, () => {
                        challenge.game.toolbar.disablePlayStop();
                    }),
                ];
                steps[1] = ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-loop-title"></i18n-text> - <i18n-text text-key="tutorial-loop-subtitle"></i18n-text>', challenge.delay * 0.8);
                steps[2] = ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-loop-step-0"></i18n-text>', challenge.delay);
                steps[3] = [
                    ChallengeStep.SvgArrowSlide(challenge, () => {
                        return document.querySelector(".machine-editor-item");
                    }, undefined, {
                        x: () => {
                            return window.innerWidth * 0.5;
                        },
                        y: () => {
                            return window.innerHeight * 0.5;
                        },
                        dir: -135,
                    }, challenge.delay * 0.8),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-loop-step-1"></i18n-text>', challenge.delay),
                    ChallengeStep.ShowEndpoints(challenge, challenge.delay),
                ];
                steps[4] = [
                    ChallengeStep.Action(challenge, () => {
                        challenge.game.toolbar.enablePlayStop();
                    }),
                    ChallengeStep.SvgArrow(challenge, () => {
                        return document.querySelector("#toolbar-play");
                    }, -155, challenge.delay * 0.8),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-play-to-run"></i18n-text>', challenge.delay * 0.8),
                ];
                steps[4][0].condition = (challenge) => {
                    return challenge.game.machine.parts.length >= 4;
                };
                steps[3][0].skipCondition = steps[4][0].condition;
                steps[5] = ChallengeStep.Wait(challenge, challenge.delay * 0.1);
                steps[5].condition = (challenge) => {
                    return challenge.game.machine.playing;
                };
            }
            else if (index === 100) {
                steps[0] = [
                    ChallengeStep.Wait(challenge, challenge.delay * 0.3),
                    ChallengeStep.Action(challenge, () => {
                        challenge.game.toolbar.disablePlayStop();
                    }),
                ];
                steps[1] = ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-rotate-title"></i18n-text> - <i18n-text text-key="tutorial-rotate-subtitle"></i18n-text>', challenge.delay * 0.8);
                if (IsTouchScreen) {
                    steps[2] = ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-tips-rotate-touch"></i18n-text>', challenge.delay);
                }
                else {
                    steps[2] = ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-tips-rotate-mouse"></i18n-text>', challenge.delay);
                }
                steps[3] = [
                    ChallengeStep.SvgArrowSlide(challenge, () => {
                        return document.querySelector(".machine-editor-item");
                    }, undefined, {
                        x: () => {
                            return window.innerWidth * 0.5;
                        },
                        y: () => {
                            return window.innerHeight * 0.5;
                        },
                        dir: -135,
                    }, challenge.delay * 0.8),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-rotate-step-0"></i18n-text>', challenge.delay),
                    ChallengeStep.ShowEndpoints(challenge, challenge.delay),
                ];
                steps[4] = [
                    ChallengeStep.ArrowSlide(challenge, () => {
                        let ramp = challenge.game.machine.parts.find((p) => {
                            return p.partName.startsWith("ramp-1.1.1");
                        });
                        if (ramp) {
                            let endPoint = ramp.endPoints.find((ep) => {
                                return !ep.connectedEndPoint;
                            });
                            if (endPoint) {
                                return endPoint.absolutePosition;
                            }
                        }
                        return BABYLON.Vector3.Zero();
                    }, BABYLON.Vector3.Down(), () => {
                        let ramp = challenge.game.machine.parts.find((p) => {
                            return p.partName.startsWith("ramp-1.1.1");
                        });
                        if (ramp) {
                            let endPoint = ramp.endPoints.find((ep) => {
                                return !ep.connectedEndPoint;
                            });
                            let otherEndPoint;
                            if (endPoint) {
                                if (endPoint.leftSide) {
                                    let uTurn = challenge.game.machine.parts.find((p) => {
                                        return p.partName.startsWith("uturn-0.2");
                                    });
                                    if (uTurn) {
                                        otherEndPoint = uTurn.endPoints.find((ep) => {
                                            return !ep.connectedEndPoint;
                                        });
                                    }
                                    if (otherEndPoint) {
                                        return otherEndPoint.absolutePosition;
                                    }
                                }
                                else {
                                    let end = challenge.game.machine.parts.find((p) => {
                                        return p.partName === "end";
                                    });
                                    if (end) {
                                        otherEndPoint = end.endPoints.find((ep) => {
                                            return !ep.connectedEndPoint;
                                        });
                                    }
                                    if (otherEndPoint) {
                                        return otherEndPoint.absolutePosition;
                                    }
                                }
                            }
                        }
                        return BABYLON.Vector3.Zero();
                    }, BABYLON.Vector3.Down(), challenge.delay * 0.8),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-rotate-step-1"></i18n-text>', challenge.delay),
                    ChallengeStep.ShowEndpoints(challenge, challenge.delay),
                ];
                steps[4][0].condition = (challenge) => {
                    return challenge.game.machine.parts.length > 6;
                };
                steps[5] = [
                    ChallengeStep.Action(challenge, () => {
                        challenge.game.toolbar.enablePlayStop();
                    }),
                    ChallengeStep.SvgArrow(challenge, () => {
                        return document.querySelector("#toolbar-play");
                    }, -155, challenge.delay * 0.8),
                    ChallengeStep.Text(challenge, '<i18n-text text-key="tutorial-play-to-run"></i18n-text>', challenge.delay * 0.8),
                ];
                steps[5][0].condition = (challenge) => {
                    let ramp = challenge.game.machine.parts.find((p) => {
                        return p.partName.startsWith("ramp-3.1.2");
                    });
                    if (ramp) {
                        if (ramp.i === -1) {
                            if (ramp.j === -4) {
                                if (ramp.k === 0) {
                                    return true;
                                }
                            }
                        }
                    }
                    return false;
                };
                steps[6] = ChallengeStep.Wait(challenge, challenge.delay * 0.1);
                steps[6].condition = (challenge) => {
                    return challenge.game.machine.playing;
                };
            }
        }
        else if (mode === ChallengeMode.Parkour && typeof (index) === "number") {
            if (index === 1) {
                steps[0] = ChallengeStep.Wait(challenge, challenge.delay * 0.3);
                steps[0].noRepeat = true;
                steps[1] = ChallengeStep.Text(challenge, '<i18n-text text-key="parkour-1-title"></i18n-text> - <i18n-text text-key="parkour-1-subtitle"></i18n-text>', challenge.delay * 0.8);
                steps[1].noRepeat = true;
                steps[2] = ChallengeStep.Text(challenge, "在街機模式中，按住「加重」按鈕可增加彈珠重量。", challenge.delay * 1);
                steps[2].noRepeat = true;
                steps[3] = [
                    ChallengeStep.Text(challenge, "按「加重」增加彈珠重量，在下坡時獲得速度", challenge.delay * 1),
                    ChallengeStep.Action(challenge, () => {
                        challenge.game.machine.pause();
                    }),
                ];
                steps[3][0].condition = (challenge) => {
                    let ball = challenge.game.machine.balls[0];
                    if (ball) {
                        return ball.position.y < 0.055;
                    }
                    return false;
                };
                steps[4] = ChallengeStep.Action(challenge, () => {
                    challenge.game.machine.play();
                });
                steps[4].condition = (challenge) => {
                    let ball = challenge.game.machine.balls[0];
                    if (ball) {
                        return ball.boosting;
                    }
                    return false;
                };
                steps[5] = [
                    ChallengeStep.Text(challenge, "放開「加重」，利用累積的速度爬坡。", challenge.delay * 1),
                    ChallengeStep.Action(challenge, () => {
                        challenge.game.machine.pause();
                    }),
                ];
                steps[5][0].condition = (challenge) => {
                    let ball = challenge.game.machine.balls[0];
                    if (ball) {
                        return ball.position.y < 0.006;
                    }
                    return false;
                };
                steps[6] = ChallengeStep.Action(challenge, () => {
                    challenge.game.machine.play();
                });
                steps[6].condition = (challenge) => {
                    let ball = challenge.game.machine.balls[0];
                    if (ball) {
                        return !ball.boosting;
                    }
                    return false;
                };
                steps[7] = ChallengeStep.Wait(challenge, 0.01);
                steps[7].condition = (challenge) => {
                    let ball = challenge.game.machine.balls[0];
                    if (ball) {
                        return ball.position.y > 0.055;
                    }
                    return false;
                };
            }
            else {
                steps[0] = ChallengeStep.Wait(challenge, challenge.delay * 0.3);
                steps[0].noRepeat = true;
                steps[1] = ChallengeStep.Text(challenge, '<i18n-text text-key="parkour-' + index.toFixed(0) + '-title"></i18n-text> - <i18n-text text-key="parkour-' + index.toFixed(0) + '-subtitle"></i18n-text>', challenge.delay * 0.8);
                steps[1].noRepeat = true;
            }
        }
        else if (mode === ChallengeMode.Puzzle && typeof (index) === "number") {
            steps[0] = ChallengeStep.Wait(challenge, challenge.delay * 0.3);
            steps[0].noRepeat = true;
            steps[1] = ChallengeStep.Text(challenge, '<i18n-text text-key="puzzle-' + index.toFixed(0) + '-title"></i18n-text> - <i18n-text text-key="puzzle-' + index.toFixed(0) + '-subtitle"></i18n-text>', challenge.delay * 0.8);
            steps[1].noRepeat = true;
            let textKey = "tutorial-puzzle-one-ball-one-end";
            if (index === 3) {
                textKey = "tutorial-puzzle-many-balls-one-end";
            }
            steps[2] = [
                ChallengeStep.Text(challenge, '<i18n-text text-key="' + textKey + '"></i18n-text>', challenge.delay),
                ChallengeStep.Arrow(challenge, () => {
                    let end = challenge.game.machine.parts.find((part) => {
                        return part.partName === "end";
                    });
                    if (end) {
                        let p = new BABYLON.Vector3(0.03, Core.tileHeight * 0.5, 0);
                        BABYLON.Vector3.TransformCoordinatesToRef(p, end.getWorldMatrix(), p);
                        return p;
                    }
                    return BABYLON.Vector3.Zero();
                }, challenge.delay * 1.2),
            ];
            steps[2][0].noRepeat = true;
        }
        else {
            steps[0] = ChallengeStep.Wait(challenge, challenge.delay * 0.3);
        }
        return steps;
    }
    static GetOnUpdateCallback(challenge, mode, index) {
        if (mode === ChallengeMode.Tutorial) {
            if (index === "simple") {
                return () => {
                    if (challenge.game.toolbar.isPlayStopDisabled()) {
                        if (challenge.steps[6][0].condition(challenge)) {
                            challenge.game.toolbar.enablePlayStop();
                        }
                    }
                };
            }
            else if (index === "rotate") {
                return () => {
                    if (challenge.game.toolbar.isPlayStopDisabled()) {
                        if (challenge.steps[4][0].condition(challenge)) {
                            challenge.game.toolbar.enablePlayStop();
                        }
                    }
                };
            }
            else if (index === "speed") {
                return () => {
                    if (challenge.game.toolbar.isPlayStopDisabled()) {
                        if (challenge.steps[4][0].condition(challenge)) {
                            challenge.game.toolbar.enablePlayStop();
                        }
                    }
                };
            }
            else if (index === "lift") {
                return () => {
                    if (challenge.game.toolbar.isPlayStopDisabled()) {
                        if (challenge.steps[5][0].condition(challenge)) {
                            challenge.game.toolbar.enablePlayStop();
                        }
                    }
                };
            }
            else if (index === "join") {
                return () => {
                    if (challenge.game.toolbar.isPlayStopDisabled()) {
                        if (challenge.steps[5][0].condition(challenge)) {
                            challenge.game.toolbar.enablePlayStop();
                        }
                    }
                };
            }
            else if (index === "split") {
                return () => {
                    if (challenge.game.toolbar.isPlayStopDisabled()) {
                        if (challenge.steps[4][0].condition(challenge)) {
                            challenge.game.toolbar.enablePlayStop();
                        }
                    }
                };
            }
            else if (index === "loop") {
                return () => {
                    if (challenge.game.toolbar.isPlayStopDisabled()) {
                        if (challenge.steps[4][0].condition(challenge)) {
                            challenge.game.toolbar.enablePlayStop();
                        }
                    }
                };
            }
        }
        else if (mode === ChallengeMode.Parkour) {
            if (index === 1) {
                return () => {
                    if (challenge.game.machine.playing) {
                        let ball = challenge.game.machine.balls[0];
                        if (ball) {
                            if (ball.collisionState != Core.CollisionState.Normal) {
                                challenge.game.machine.playing = false;
                                challenge.failure = true;
                            }
                            else if (ball.position.y - ball.radius < challenge.game.machine.pedestalTop.position.y + 0.001) {
                                challenge.failure = true;
                            }
                        }
                    }
                    if (challenge.lastStepRunned === 2 || challenge.lastStepRunned === 3) {
                        let ball = challenge.game.machine.balls[0];
                        if (ball && ball.boosting) {
                            challenge.skipButton.htmlButton.onclick(undefined);
                        }
                    }
                    else if (challenge.lastStepRunned === 4) {
                        let ball = challenge.game.machine.balls[0];
                        if (ball) {
                            ball.boosting = true;
                        }
                    }
                    else if (challenge.lastStepRunned === 5) {
                        let ball = challenge.game.machine.balls[0];
                        if (ball && !ball.boosting) {
                            challenge.skipButton.htmlButton.onclick(undefined);
                        }
                    }
                    else if (challenge.lastStepRunned === 6) {
                        let ball = challenge.game.machine.balls[0];
                        if (ball) {
                            ball.boosting = false;
                        }
                    }
                };
            }
            else {
                return () => {
                    if (challenge.game.machine.playing) {
                        let ball = challenge.game.machine.balls[0];
                        if (ball) {
                            if (ball.collisionState != Core.CollisionState.Normal) {
                                challenge.game.machine.playing = false;
                                challenge.failure = true;
                            }
                            else if (ball.position.y - ball.radius < challenge.game.machine.pedestalTop.position.y + 0.001) {
                                challenge.failure = true;
                            }
                        }
                    }
                };
            }
        }
    }
}
class DebugPerf {
    constructor(main, _showLayer = false) {
        this.main = main;
        this._showLayer = _showLayer;
        this._initialized = false;
        this._counter = 0;
        this._update = () => {
            this._frameRate.addValue(this.main.engine.getFps());
            this._meshesCount.setText(this.main.scene.meshes.length.toFixed(0));
            this._materialsCount.setText(this.main.scene.materials.length.toFixed(0));
            this._counter++;
            if (this._counter > 60) {
                this._counter = 0;
                let globalTriCount = 0;
                this.main.scene.meshes.forEach(mesh => {
                    let indices = mesh.getIndices();
                    if (indices) {
                        globalTriCount += indices.length / 3;
                    }
                });
                this._trianglesCount.setText(globalTriCount.toFixed(0));
            }
        };
        setInterval(() => {
            //this.DEBUG_LogMeshesNames();
        }, 3000);
    }
    get initialized() {
        return this._initialized;
    }
    get scene() {
        return this.main.scene;
    }
    initialize() {
        this.debugContainer = document.querySelector("#debug-container");
        if (!this.debugContainer) {
            this.debugContainer = document.createElement("div");
            this.debugContainer.id = "debug-container";
            document.body.appendChild(this.debugContainer);
        }
        this.container = document.querySelector("#debug-terrain-perf");
        if (!this.container) {
            this.container = document.createElement("div");
            this.container.id = "debug-terrain-perf";
            this.container.classList.add("debug", "hidden");
            this.debugContainer.appendChild(this.container);
        }
        let frameRateId = "#frame-rate";
        this._frameRate = document.querySelector(frameRateId);
        if (!this._frameRate) {
            this._frameRate = document.createElement("debug-display-frame-value");
            this._frameRate.id = frameRateId;
            this._frameRate.setAttribute("label", "Frame Rate");
            this._frameRate.setAttribute("min", "0");
            if (IsMobile === 1) {
                this._frameRate.setAttribute("max", "60");
            }
            else {
                this._frameRate.setAttribute("max", "144");
            }
            this._frameRate.style.outline = "1px solid lime";
            this.container.appendChild(this._frameRate);
        }
        let meshesCountId = "#meshes-count";
        this._meshesCount = document.querySelector(meshesCountId);
        if (!this._meshesCount) {
            this._meshesCount = document.createElement("debug-display-text-value");
            this._meshesCount.id = meshesCountId;
            this._meshesCount.setAttribute("label", "Meshes Count");
            this.container.appendChild(this._meshesCount);
        }
        let materialsCountId = "#materials-count";
        this._materialsCount = document.querySelector(materialsCountId);
        if (!this._materialsCount) {
            this._materialsCount = document.createElement("debug-display-text-value");
            this._materialsCount.id = materialsCountId;
            this._materialsCount.setAttribute("label", "Materials Count");
            this.container.appendChild(this._materialsCount);
        }
        let trianglesCountId = "#triangles-count";
        this._trianglesCount = document.querySelector(trianglesCountId);
        if (!this._trianglesCount) {
            this._trianglesCount = document.createElement("debug-display-text-value");
            this._trianglesCount.id = trianglesCountId;
            this._trianglesCount.setAttribute("label", "Tris Count");
            this.container.appendChild(this._trianglesCount);
        }
        this._initialized = true;
    }
    show() {
        if (!this.initialized) {
            this.initialize();
        }
        this.container.classList.remove("hidden");
        this.scene.onBeforeRenderObservable.add(this._update);
    }
    hide() {
        this.container.classList.add("hidden");
        this.scene.onBeforeRenderObservable.removeCallback(this._update);
    }
    DEBUG_LogMeshesNames() {
        let meshesNames = this.scene.meshes.map(m => { return m.name; });
        let countedMeshes = [];
        meshesNames.forEach(name => {
            let e = countedMeshes.find(cm => { return cm.name === name; });
            if (e) {
                e.count++;
            }
            else {
                countedMeshes.push({ name: name, count: 1 });
            }
        });
        countedMeshes.sort((e1, e2) => { return e2.count - e1.count; });
        console.log("-");
        for (let i = 0; i < 6; i++) {
            let e = countedMeshes[i];
            if (e) {
                console.log(e.count.toFixed(0).padStart(4, "0") + " " + e.name);
            }
        }
        console.log("-");
    }
}
var fallbackMachine = { n: "遺失機械", a: "Tiaratum Games", v: 3, d: "01i57hz4i1o0706hwi1hz203111000hyi1hz403121000hyi0hz211111006i0hzhz314121006hxhzhz304111000i0hzhz20110100bi2hyhz2311010" };
// Spiral
// Stairway
// Elevator
// Shooter
// Speeder
var Default3DTracks = [
    { v: 12, d: "01hxhi03i23030406hvi3i02i6i0i1120100dhxi3i00i9i1i112050000000hwhxi00i9i1i01201006i5hxi10i6i0i11201000000100z003" },
    { v: 12, d: "01i29i1ji2s02040ci2i4i22i8i1i11204012006hvi4i32i6i0i11001006i4hyi20i6i0i11201000hwhyi30i8hzi01201000000100z003" },
    { v: 12, d: "01huqi0ohxx040600hwi3i30i9hzi01201006hvi3i32i3i0i1110100bhuhxi02i2i3i11204000000hwhxi10i9i1i01201006i5hxi20i6i0i11201006hwhxi30i3i0i11101000000100z003" },
    { v: 12, d: "01hvbi29i2305060ihui3i02i1i5i102050006200hwi3i30i9i1i01201006hwi0i50i3i0i11101006hvi0i52i3i0i11101006i5hxi40i6i0i11201000hwhxi50i9hzi01201000000100z003" },
    { v: 12, d: "01hwvi0qi2106060lhzi3i00i3i0i11201006hui3i12i6i0i11201000i2i3i00i4i1i01201000hvi3i10i4hzi01201006i6hxi10i6i0i11201000hvhxi10ibi0i01201000000100z003" },
    { v: 12, mode: 1, content: "01i38i27i0p00070ii4i1i00i1i5i102050000006i2i4i32i3i0i1120100pi3hxi30i7i0i11201000hvhxi40i8hzi0120100phui1i52i4hzi11201000hyi1i52i4i0i0120100oi2i1i52i4i0i01201000000100z003", sp: { grndAnchors: true, grndAnchorsMaxY: 1, spacing: 0.03 } },
    { v: 12, mode: 1, content: "01i38i27i0p00070ii4i1i00i1i5i102050000006i2i4i32i3i0i1120100pi3hxi30i7i0i11201000hvhxi40i8hzi0120100phui1i52i4hzi11201000hyi1i52i4i0i0120100oi2i1i52i4i0i01201000000100z003", sp: { grndAnchors: true, grndAnchorsMaxY: 1, spacing: 0.03 } },
    { v: 12, mode: 1, content: "01i38i27i0p00070ii4i1i00i1i5i102050000006i2i4i32i3i0i1120100pi3hxi30i7i0i11201000hvhxi40i8hzi0120100phui1i52i4hzi11201000hyi1i52i4i0i0120100oi2i1i52i4i0i01201000000100z003", sp: { grndAnchors: true, grndAnchorsMaxY: 1, spacing: 0.03 } },
    { v: 12, mode: 1, content: "01i38i27i0p00070ii4i1i00i1i5i102050000006i2i4i32i3i0i1120100pi3hxi30i7i0i11201000hvhxi40i8hzi0120100phui1i52i4hzi11201000hyi1i52i4i0i0120100oi2i1i52i4i0i01201000000100z003", sp: { grndAnchors: true, grndAnchorsMaxY: 1, spacing: 0.03 } },
    { v: 12, mode: 1, content: "01i38i27i0p00070ii4i1i00i1i5i102050000006i2i4i32i3i0i1120100pi3hxi30i7i0i11201000hvhxi40i8hzi0120100phui1i52i4hzi11201000hyi1i52i4i0i0120100oi2i1i52i4i0i01201000000100z003", sp: { grndAnchors: true, grndAnchorsMaxY: 1, spacing: 0.03 } },
];
var Default2DTracks = [
    { v: 12, mode: 2, content: "03hwti2ti0000hwti4xi0000hwti71i00000908i6i0i02i1i2i11202c008i9i0i20i1i2i11202c00bhxi0i32i2i8i11204cc0002i7i0i42i9i0i31001c00hzi0ib0i4i0i01201c08i9i0i00i1i7i11202c000i3i0i70i5i0i01201c12i3i0i90i1i2i11101c08i1i0i72i1i2i11202c000000100z003", sp: { grndAnchors: true, grndAnchorsMaxY: 0.35, spacing: 0.03 } },
    { v: 12, mode: 2, content: "02i77i7xi0000i7ci2wi0000081ahyi0i12i1i4i1120101ai1i0i50i1i3i1120101ahyi0i82i1i2i1120100iiai0i10i1iai10205000000oi5i0i60i4hyi01201000i0i0i10i5i5i01201000i2i0i92i3i1i0120100oi8i0ib2i6hyi01201000000100z003", sp: { grndAnchors: true, grndAnchorsMaxY: 0.35, spacing: 0.03 } },
];
var DefaultBBPuzzleTrack = { title: "環繞", author: "Tiaratum Games", country: "us", v: 13, mode: 2, content: "01i0oiagi000k031hi1i0i10i1i1i11201a1ei0i0i10igigi182037891ii4i0i80i9i2i112017000000d100z003", sp: { grndAnchors: true, grndAnchorsMaxY: 0.35, spacing: 0.03 } };
function RandomDefault3DTrack() {
    let n = Math.floor(Math.random() * Default3DTracks.length);
    return Default3DTracks[n];
}
function RandomDefault2DTrack() {
    let n = Math.floor(Math.random() * Default2DTracks.length);
    return Default2DTracks[n];
}
class DevMode {
    constructor(game) {
        this.game = game;
        this.activationCounter = 0;
        this.activated = false;
        this.lastQueriedIds = [];
        this.cancelActivationTimout = 0;
    }
    getPassword() {
        let passwordInput = document.querySelector("#dev-mode-password-input");
        return passwordInput.value;
    }
    isVideoModeSquareOn() {
        let videoModeSquareInput = document.querySelector("#dev-mode-video-mode-square");
        return videoModeSquareInput.checked;
    }
    initialize() {
        document.querySelector("#home-menu .top-container").onclick = () => {
            this.incActivation();
        };
        let devToolbarStateBtns = document.querySelectorAll("#dev-mode-toolbar .dev-mode-btn");
        for (let i = Core.MachineDBState.Pending; i <= Core.MachineDBState.Star; i++) {
            devToolbarStateBtns[i].onclick = async (ev) => {
                ev.stopPropagation();
                let id = this.game.machine.dbId;
                let dbState = i;
                if (isFinite(id)) {
                    let data = {
                        id: id,
                        state: dbState
                    };
                    let dataString = JSON.stringify(data);
                    const response = await fetch(SHARE_SERVICE_PATH + "set_machine_state", {
                        method: "POST",
                        mode: "cors",
                        headers: {
                            "Authorization": 'Basic ' + btoa("carillon:" + this.game.devMode.getPassword())
                        },
                        body: dataString,
                    });
                    this.game.machine.dbState = dbState;
                }
            };
        }
        let prevToolbarBtn = document.querySelector("#dev-mode-toolbar .prev");
        prevToolbarBtn.onclick = () => {
            let index = this.lastQueriedIds.indexOf(this.game.machine.dbId);
            if (index != -1) {
                let prevMachineId = this.lastQueriedIds[index - 1];
                if (isFinite(prevMachineId)) {
                    location.href = "#machine?id=" + prevMachineId.toFixed(0);
                }
            }
        };
        let nextToolbarBtn = document.querySelector("#dev-mode-toolbar .next");
        nextToolbarBtn.onclick = () => {
            let index = this.lastQueriedIds.indexOf(this.game.machine.dbId);
            if (index != -1) {
                let nextMachineId = this.lastQueriedIds[index + 1];
                if (isFinite(nextMachineId)) {
                    location.href = "#machine?id=" + nextMachineId.toFixed(0);
                }
            }
        };
        this.filterMachines = [true, true, true, true, true, true];
        this.filterMachinesBtns = [];
        this.filterMachinesBtns[Core.MachineDBState.Pending] = document.querySelector("#machine-page-filter-tbd");
        this.filterMachinesBtns[Core.MachineDBState.Ok] = document.querySelector("#machine-page-filter-ok");
        this.filterMachinesBtns[Core.MachineDBState.Star] = document.querySelector("#machine-page-filter-star");
        this.filterMachinesBtns[Core.MachineDBState.NOk] = document.querySelector("#machine-page-filter-nok");
        this.filterMachinesBtns[Core.MachineDBState.Problem] = document.querySelector("#machine-page-filter-problem");
        this.filterMachinesBtns[Core.MachineDBState.Info] = document.querySelector("#machine-page-filter-info");
        for (let state = Core.MachineDBState.Pending; state <= Core.MachineDBState.Star; state++) {
            this.filterMachinesBtns[state].onclick = () => {
                this.filterMachines[state] = !this.filterMachines[state];
                if (this.game.router.communityMenu.pageNum != 1) {
                    location.href = "#community?page=1";
                }
                else {
                    this.game.router.communityMenu.redraw(1);
                }
                if (this.filterMachines[state]) {
                    this.filterMachinesBtns[state].classList.add("active");
                }
                else {
                    this.filterMachinesBtns[state].classList.remove("active");
                }
            };
        }
        this.game.scene.onBeforeRenderObservable.add(() => {
            if (this.activationCounter === 0) {
                document.querySelector("#dev-mode-debug").style.display = "none";
            }
            else {
                document.querySelector("#dev-mode-debug").style.display = "block";
                document.querySelector("#dev-mode-debug").innerText = this.activationCounter.toFixed(0);
            }
            let currentState = this.game.machine.dbState;
            for (let i = Core.MachineDBState.Pending; i <= Core.MachineDBState.Star; i++) {
                devToolbarStateBtns[i].classList.remove("active");
            }
            devToolbarStateBtns[currentState].classList.add("active");
        });
        //<img id="video-mode-logo" style="display: none;" src=""/>
        document.querySelector("#dev-mode-video-mode-square").onchange = () => {
            let logo = document.querySelector("#video-mode-logo");
            let pokiLabel = document.querySelector("#video-mode-poki-label");
            let pokiLogo = document.querySelector("#video-mode-poki-logo");
            if (this.isVideoModeSquareOn()) {
                document.body.classList.add("square");
                if (!logo) {
                    logo = document.createElement("img");
                    logo.id = "video-mode-logo";
                    logo.src = "datas/icons/title-text-only.png";
                    document.body.appendChild(logo);
                }
                if (logo) {
                    logo.style.display = "block";
                }
                if (!pokiLabel) {
                    pokiLabel = document.createElement("div");
                    pokiLabel.id = "video-mode-poki-label";
                    pokiLabel.innerHTML = "僅限於";
                    document.body.appendChild(pokiLabel);
                }
                if (pokiLabel) {
                    pokiLabel.style.display = "block";
                }
                if (!pokiLogo) {
                    pokiLogo = document.createElement("img");
                    pokiLogo.id = "video-mode-poki-logo";
                    pokiLogo.src = "datas/icons/poki.svg";
                    document.body.appendChild(pokiLogo);
                }
                if (pokiLogo) {
                    pokiLogo.style.display = "block";
                }
            }
            else {
                document.body.classList.remove("square");
                if (logo) {
                    logo.style.display = "none";
                }
                if (pokiLabel) {
                    pokiLabel.style.display = "none";
                }
                if (pokiLogo) {
                    pokiLogo.style.display = "none";
                }
            }
        };
        if (location.host.startsWith("127.0.0.1")) {
            //(document.querySelector("#dev-mode-password-input") as HTMLInputElement).value = "Crillion";
            //this.activate();
        }
    }
    incActivation() {
        if (location.host.startsWith("127.0.0.1")) {
            this.activationCounter++;
            clearTimeout(this.cancelActivationTimout);
            this.cancelActivationTimout = setTimeout(() => { this.activationCounter = 0; }, 5000);
        }
        if (this.activationCounter < 2) {
            if (!this.game.machine.playing) {
                this.activationCounter++;
                clearTimeout(this.cancelActivationTimout);
                this.cancelActivationTimout = setTimeout(() => { this.activationCounter = 0; }, 5000);
            }
        }
        else if (this.activationCounter < 4) {
            if (this.game.machine.playing) {
                this.activationCounter++;
                clearTimeout(this.cancelActivationTimout);
                this.cancelActivationTimout = setTimeout(() => { this.activationCounter = 0; }, 5000);
            }
        }
        else if (this.activationCounter < 6) {
            if (!this.game.machine.playing) {
                this.activationCounter++;
                clearTimeout(this.cancelActivationTimout);
                this.cancelActivationTimout = setTimeout(() => { this.activationCounter = 0; }, 5000);
            }
        }
        else if (this.activationCounter >= 6) {
            this.activate();
        }
    }
    activate() {
        this.activated = true;
        document.querySelector("#machine-page-state-filters").style.display = "";
        document.querySelector("#dev-mode").style.display = "block";
        document.querySelector("#dev-mode-info").style.display = "block";
        if (this.game.shareMenuView && this.game.shareMenuView.devUpdateBtn) {
            this.game.shareMenuView.devUpdateBtn.style.display = "";
        }
    }
}
class HelperShape {
    constructor() {
        this.show = true;
        this.showCircle = false;
        this.showGrid = false;
        this.circleRadius = 350;
        this.gridSize = 100;
    }
    setShow(b) {
        this.show = b;
        this.update();
    }
    setShowCircle(b) {
        this.showCircle = b;
        this.update();
    }
    setCircleRadius(r) {
        this.circleRadius = Math.max(Math.min(r, 500), 50);
        this.update();
    }
    setShowGrid(b) {
        this.showGrid = b;
        this.update();
    }
    setGridSize(s) {
        this.gridSize = Math.max(Math.min(s, 500), 50);
        this.gridSize = s;
        this.update();
    }
    update() {
        if (!this.svg) {
            this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            this.svg.setAttribute("width", "1000");
            this.svg.setAttribute("height", "1000");
            this.svg.setAttribute("viewBox", "0 0 1000 1000");
            this.svg.style.position = "fixed";
            this.svg.style.width = "min(100vw, 100vh)";
            this.svg.style.height = "min(100vw, 100vh)";
            this.svg.style.left = "calc((100vw - min(100vw, 100vh)) * 0.5)";
            this.svg.style.top = "calc((100vh - min(100vw, 100vh)) * 0.5)";
            this.svg.style.zIndex = "1";
            this.svg.style.pointerEvents = "none";
            document.body.appendChild(this.svg);
        }
        this.svg.innerHTML = "";
        if (this.show && this.showCircle) {
            let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("fill", "none");
            circle.setAttribute("stroke", "black");
            circle.setAttribute("stroke-width", "1");
            circle.setAttribute("cx", "500");
            circle.setAttribute("cy", "500");
            circle.setAttribute("r", this.circleRadius.toFixed(1));
            this.svg.appendChild(circle);
            for (let i = 0; i < 32; i++) {
                let graduation = document.createElementNS("http://www.w3.org/2000/svg", "line");
                graduation.setAttribute("stroke", "black");
                graduation.setAttribute("stroke-width", "1");
                graduation.setAttribute("x1", (500 + this.circleRadius - 20).toFixed(1));
                graduation.setAttribute("y1", "500");
                graduation.setAttribute("x2", (500 + this.circleRadius + 20).toFixed(1));
                graduation.setAttribute("y2", "500");
                graduation.setAttribute("transform", "rotate(" + (i * 360 / 32).toFixed(1) + " 500 500)");
                this.svg.appendChild(graduation);
            }
        }
        if (this.show && this.showGrid) {
            let count = Math.round(500 / this.gridSize);
            for (let i = 1; i < count; i++) {
                let d = i * this.gridSize;
                let lineTop = document.createElementNS("http://www.w3.org/2000/svg", "line");
                lineTop.setAttribute("stroke", "black");
                lineTop.setAttribute("stroke-width", "1");
                lineTop.setAttribute("x1", "0");
                lineTop.setAttribute("y1", (500 - d).toFixed(1));
                lineTop.setAttribute("x2", "1000");
                lineTop.setAttribute("y2", (500 - d).toFixed(1));
                this.svg.appendChild(lineTop);
                let lineBottom = document.createElementNS("http://www.w3.org/2000/svg", "line");
                lineBottom.setAttribute("stroke", "black");
                lineBottom.setAttribute("stroke-width", "1");
                lineBottom.setAttribute("x1", "0");
                lineBottom.setAttribute("y1", (500 + d).toFixed(1));
                lineBottom.setAttribute("x2", "1000");
                lineBottom.setAttribute("y2", (500 + d).toFixed(1));
                this.svg.appendChild(lineBottom);
                let lineLeft = document.createElementNS("http://www.w3.org/2000/svg", "line");
                lineLeft.setAttribute("stroke", "black");
                lineLeft.setAttribute("stroke-width", "1");
                lineLeft.setAttribute("x1", (500 - d).toFixed(1));
                lineLeft.setAttribute("y1", "0");
                lineLeft.setAttribute("x2", (500 - d).toFixed(1));
                lineLeft.setAttribute("y2", "1000");
                this.svg.appendChild(lineLeft);
                let lineRight = document.createElementNS("http://www.w3.org/2000/svg", "line");
                lineRight.setAttribute("stroke", "black");
                lineRight.setAttribute("stroke-width", "1");
                lineRight.setAttribute("x1", (500 + d).toFixed(1));
                lineRight.setAttribute("y1", "0");
                lineRight.setAttribute("x2", (500 + d).toFixed(1));
                lineRight.setAttribute("y2", "1000");
                this.svg.appendChild(lineRight);
            }
        }
        if (this.show && (this.showCircle || this.showGrid)) {
            let centerLineH = document.createElementNS("http://www.w3.org/2000/svg", "line");
            centerLineH.setAttribute("stroke", "black");
            centerLineH.setAttribute("stroke-width", "1");
            centerLineH.setAttribute("x1", "0");
            centerLineH.setAttribute("y1", "500");
            centerLineH.setAttribute("x2", "1000");
            centerLineH.setAttribute("y2", "500");
            this.svg.appendChild(centerLineH);
            let centerLineV = document.createElementNS("http://www.w3.org/2000/svg", "line");
            centerLineV.setAttribute("stroke", "black");
            centerLineV.setAttribute("stroke-width", "1");
            centerLineV.setAttribute("x1", "500");
            centerLineV.setAttribute("y1", "0");
            centerLineV.setAttribute("x2", "500");
            centerLineV.setAttribute("y2", "1000");
            this.svg.appendChild(centerLineV);
        }
    }
}
class LikeManager {
    constructor(game) {
        this.game = game;
        this.likedMachineIds = [];
        this.unlikedMachineIds = [];
    }
    initialize() {
        if (HasLocalStorage) {
            let dataString = localStorage.getItem("liked-machines");
            if (dataString) {
                let data = JSON.parse(dataString);
                if (data) {
                    this.likedMachineIds = data;
                }
            }
        }
    }
    saveToLocalStorage() {
        if (HasLocalStorage) {
            localStorage.setItem("liked-machines", JSON.stringify(this.likedMachineIds));
        }
    }
    isCurrentMachineLiked() {
        return this.isLiked(this.game.machine.dbId);
    }
    isLiked(id) {
        return this.likedMachineIds.indexOf(id) != -1;
    }
    isUnliked(id) {
        return this.likedMachineIds.indexOf(-id) != -1;
    }
    async like(id) {
        if (!this.game.devMode.activated && this.isLiked(id)) {
            return;
        }
        if (this.likedMachineIds.indexOf(id) === -1) {
            this.likedMachineIds.push(id);
        }
        if (this.game.machine.dbId === id) {
            this.game.machine.dbLikes++;
        }
        if (!this.game.OFFLINE_MODE) {
            if (this.game.devMode.activated || !this.isUnliked(id)) {
                await fetch(SHARE_SERVICE_PATH + "like/" + id.toFixed(0), {
                    method: "POST",
                    mode: "cors",
                });
            }
        }
        this.saveToLocalStorage();
    }
    async unlike(id) {
        if (!this.isLiked(id)) {
            return;
        }
        let i = this.likedMachineIds.indexOf(id);
        if (i >= 0) {
            this.likedMachineIds.splice(i, 1);
            this.likedMachineIds.push(-id);
            if (this.game.machine.dbId === id) {
                this.game.machine.dbLikes--;
            }
            this.saveToLocalStorage();
        }
    }
}
/// <reference path="../lib/babylon.d.ts"/>
/// <reference path="../../nabu/nabu.d.ts"/>
/// <reference path="../../mummu/mummu.d.ts"/>
/// <reference path="../../marble-run-simulator-core/marble-run-simulator-core.d.ts"/>
var MRS_VERSION = 9;
var MRS_VERSION2 = 8;
var MRS_VERSION3 = 3;
var CHALLENGE_VERSION = MRS_VERSION * 1000 + MRS_VERSION2 * 100 + MRS_VERSION3;
var CONFIGURATION_VERSION = MRS_VERSION * 1000 + MRS_VERSION2 * 100 + MRS_VERSION3;
var observed_progress_speed_percent_second;
var USE_POKI_SDK;
var BB_PUZZLE_ONLY;
var PokiSDK;
var PokiSDKPlaying = false;
function PokiGameplayStart() {
    if (USE_POKI_SDK) {
        if (!PokiSDKPlaying) {
            console.log("PokiSDK.gameplayStart");
            PokiSDK.gameplayStart();
            PokiSDKPlaying = true;
        }
    }
}
var CanStartCommercialBreak = false;
async function PokiCommercialBreak() {
    if (!USE_POKI_SDK) {
        return;
    }
    if (!CanStartCommercialBreak) {
        return;
    }
    if (location.host.startsWith("127.0.0.1")) {
        return;
    }
    let prevMainVolume = BABYLON.Engine.audioEngine.getGlobalVolume();
    BABYLON.Engine.audioEngine.setGlobalVolume(0);
    await PokiSDK.commercialBreak();
    BABYLON.Engine.audioEngine.setGlobalVolume(prevMainVolume);
}
function PokiGameplayStop() {
    if (USE_POKI_SDK) {
        if (PokiSDKPlaying) {
            PokiSDK.gameplayStop();
            PokiSDKPlaying = false;
        }
    }
}
var PlayerHasInteracted = false;
var IsTouchScreen = -1;
var IsMobile = -1;
var HasLocalStorage = false;
async function WaitPlayerInteraction() {
    return new Promise(resolve => {
        let wait = () => {
            if (PlayerHasInteracted) {
                resolve();
            }
            else {
                requestAnimationFrame(wait);
            }
        };
        wait();
    });
}
let onFirstPlayerInteractionTouch = (ev) => {
    console.log("onFirstPlayerInteractionTouch");
    ev.stopPropagation();
    PlayerHasInteracted = true;
    document.body.removeEventListener("touchstart", onFirstPlayerInteractionTouch);
    document.body.removeEventListener("click", onFirstPlayerInteractionClic);
    document.body.removeEventListener("keydown", onFirstPlayerInteractionKeyboard);
    //Game.Instance.showGraphicAutoUpdateAlert("Touch");
    document.getElementById("click-anywhere-screen").style.display = "none";
    Game.Instance.onResize();
    IsTouchScreen = 1;
    IsMobile = /(?:phone|windows\s+phone|ipod|blackberry|(?:android|bb\d+|meego|silk|googlebot) .+? mobile|palm|windows\s+ce|opera\smini|avantgo|mobilesafari|docomo)/i.test(navigator.userAgent) ? 1 : 0;
    if (IsMobile === 1) {
        document.body.classList.add("mobile");
        Game.Instance.constructionModeMenuView.setSelectedMode(Core.MachineConstructionMode.Mode2D);
        Game.Instance.constructionModeMenuView.setRecommandedMode(Core.MachineConstructionMode.Mode2D);
    }
    else {
        Game.Instance.constructionModeMenuView.setSelectedMode(Core.MachineConstructionMode.Mode3D);
        Game.Instance.constructionModeMenuView.setRecommandedMode(Core.MachineConstructionMode.Mode3D);
    }
    Game.Instance.config.getElement("pan-precision").forceInit();
    if (Game.Instance.machine && Game.Instance.machine.instantiated) {
        Game.Instance.machine.instantiate(true);
    }
    if (Game.Instance.ambientMusic) {
        Game.Instance.ambientMusic.play();
    }
};
let onFirstPlayerInteractionClic = (ev) => {
    console.log("onFirstPlayerInteractionClic");
    ev.stopPropagation();
    PlayerHasInteracted = true;
    document.body.removeEventListener("touchstart", onFirstPlayerInteractionTouch);
    document.body.removeEventListener("click", onFirstPlayerInteractionClic);
    document.body.removeEventListener("keydown", onFirstPlayerInteractionKeyboard);
    //Game.Instance.showGraphicAutoUpdateAlert("Clic");
    document.getElementById("click-anywhere-screen").style.display = "none";
    Game.Instance.onResize();
    IsTouchScreen = 0;
    IsMobile = /(?:phone|windows\s+phone|ipod|blackberry|(?:android|bb\d+|meego|silk|googlebot) .+? mobile|palm|windows\s+ce|opera\smini|avantgo|mobilesafari|docomo)/i.test(navigator.userAgent) ? 1 : 0;
    if (IsMobile === 1) {
        document.body.classList.add("mobile");
        Game.Instance.constructionModeMenuView.setSelectedMode(Core.MachineConstructionMode.Mode2D);
        Game.Instance.constructionModeMenuView.setRecommandedMode(Core.MachineConstructionMode.Mode2D);
    }
    else {
        Game.Instance.constructionModeMenuView.setSelectedMode(Core.MachineConstructionMode.Mode3D);
        Game.Instance.constructionModeMenuView.setRecommandedMode(Core.MachineConstructionMode.Mode3D);
    }
    Game.Instance.config.getElement("pan-precision").forceInit();
    if (Game.Instance.ambientMusic) {
        Game.Instance.ambientMusic.play();
    }
};
let onFirstPlayerInteractionKeyboard = (ev) => {
    console.log("onFirstPlayerInteractionKeyboard");
    ev.stopPropagation();
    PlayerHasInteracted = true;
    document.body.removeEventListener("touchstart", onFirstPlayerInteractionTouch);
    document.body.removeEventListener("click", onFirstPlayerInteractionClic);
    document.body.removeEventListener("keydown", onFirstPlayerInteractionKeyboard);
    //Game.Instance.showGraphicAutoUpdateAlert("Keyboard");
    document.getElementById("click-anywhere-screen").style.display = "none";
    Game.Instance.onResize();
    IsTouchScreen = 0;
    IsMobile = /(?:phone|windows\s+phone|ipod|blackberry|(?:android|bb\d+|meego|silk|googlebot) .+? mobile|palm|windows\s+ce|opera\smini|avantgo|mobilesafari|docomo)/i.test(navigator.userAgent) ? 1 : 0;
    if (IsMobile === 1) {
        document.body.classList.add("mobile");
        Game.Instance.constructionModeMenuView.setSelectedMode(Core.MachineConstructionMode.Mode2D);
        Game.Instance.constructionModeMenuView.setRecommandedMode(Core.MachineConstructionMode.Mode2D);
    }
    else {
        Game.Instance.constructionModeMenuView.setSelectedMode(Core.MachineConstructionMode.Mode3D);
        Game.Instance.constructionModeMenuView.setRecommandedMode(Core.MachineConstructionMode.Mode3D);
    }
    Game.Instance.config.getElement("pan-precision").forceInit();
    if (Game.Instance.ambientMusic) {
        Game.Instance.ambientMusic.play();
    }
};
var CHECK_SERVICE_MACHINE_ID = 603;
var SHARE_SERVICE_PATH = "https://marble.tiaratum.com/index.php/";
var LOCAL_SHARE_SERVICE_PATH = "http://localhost/index.php/";
if (location.host.startsWith("127.0.0.1")) {
    //SHARE_SERVICE_PATH = LOCAL_SHARE_SERVICE_PATH;
    //CHECK_SERVICE_MACHINE_ID = 6147;
}
var Core = MarbleRunSimulatorCore;
function addLine(text) {
    let e = document.createElement("div");
    e.classList.add("debug-log");
    e.innerText = text;
    document.body.appendChild(e);
}
function StopPointerProgatation(ev) {
    ev.stopPropagation();
}
function StopPointerProgatationAndMonkeys(ev) {
    console.log("StopPointerProgatationAndMonkeys");
    ev.stopPropagation();
    if (Game.Instance) {
        if (Game.Instance.machineEditor) {
            Game.Instance.machineEditor.doCancelPendingInsertionCaller();
        }
    }
}
var GameMode;
(function (GameMode) {
    GameMode[GameMode["Home"] = 0] = "Home";
    GameMode[GameMode["Page"] = 1] = "Page";
    GameMode[GameMode["Create"] = 2] = "Create";
    GameMode[GameMode["Challenge"] = 3] = "Challenge";
    GameMode[GameMode["BBPuzzle"] = 4] = "BBPuzzle";
    GameMode[GameMode["Demo"] = 5] = "Demo";
})(GameMode || (GameMode = {}));
var CameraMode;
(function (CameraMode) {
    CameraMode[CameraMode["Dev"] = 0] = "Dev";
    CameraMode[CameraMode["None"] = 1] = "None";
    CameraMode[CameraMode["Ball"] = 2] = "Ball";
    CameraMode[CameraMode["Landscape"] = 3] = "Landscape";
    CameraMode[CameraMode["Selected"] = 4] = "Selected";
    CameraMode[CameraMode["Focusing"] = 5] = "Focusing";
    CameraMode[CameraMode["FocusingSelected"] = 6] = "FocusingSelected";
    CameraMode[CameraMode["Transition"] = 7] = "Transition";
    CameraMode[CameraMode["Movie"] = 8] = "Movie";
    CameraMode[CameraMode["MovieIdle"] = 9] = "MovieIdle";
    CameraMode[CameraMode["FirstPersonBall"] = 10] = "FirstPersonBall";
    CameraMode[CameraMode["SideViewBall"] = 11] = "SideViewBall";
})(CameraMode || (CameraMode = {}));
class Game {
    constructor(canvasElement) {
        this.OFFLINE_MODE = false;
        this.DEBUG_MODE = false;
        this.DEBUG_USE_LOCAL_STORAGE = false;
        this.animateCurtainOpacity = Mummu.AnimationFactory.EmptyNumberCallback;
        this.screenRatio = 1;
        this.cameraMode = CameraMode.None;
        this.menuCameraMode = CameraMode.Landscape;
        this.targetCamTarget = BABYLON.Vector3.Zero();
        this.targetCamAlpha = -Math.PI * 0.5;
        this.targetCamBeta = Math.PI * 0.4;
        this.targetCamRadius = 0.8;
        this.targetCamRadiusFromWheel = false;
        this._trackTargetCamSpeed = 0;
        this.completedChallenges = {
            version: 0,
            tutorial: [],
            parkour: [],
            puzzle: []
        };
        this.cameraOrtho = false;
        this.animateCamera = Mummu.AnimationFactory.EmptyNumbersCallback;
        this.animateCameraTarget = Mummu.AnimationFactory.EmptyVector3Callback;
        this._targetTimeFactor = 1;
        this.timeFactor = 0.1;
        this.physicDT = 0.0005;
        this.gridKMin = 0;
        this.onResize = () => {
            this.screenRatio = window.innerWidth / window.innerHeight;
            if (this.screenRatio < 1) {
                document.body.classList.add("vertical");
                this.ballCamera.sideViewRadius = 0.8;
            }
            else {
                document.body.classList.remove("vertical");
                this.ballCamera.sideViewRadius = 0.5;
            }
            this.engine.resize();
            this.resizeCanvas();
            if (this.toolbar) {
                this.toolbar.resize();
            }
            if (this.topbar) {
                this.topbar.resize();
            }
            if (this.router) {
                if (this.router.homeMenu) {
                    this.router.homeMenu.reinitScrolls();
                }
            }
        };
        this.movieIdleDir = BABYLON.Vector3.Zero();
        this.factoredTimeSinceGameStart = 0;
        this.averagedFPS = 0;
        this.updateConfigTimeout = -1;
        this._lastCameraTarget = BABYLON.Vector3.Zero();
        this.machineEditorContainerIsDisplayed = false;
        this.machineEditorContainerHeight = -1;
        this.machineEditorContainerWidth = -1;
        this.canvasLeft = 0;
        this._hideGraphicAutoUpdateAlertTimout = 0;
        this._showGraphicAutoUpdateAlertInterval = 0;
        this._pointerDownX = 0;
        this._pointerDownY = 0;
        this.onPointerDown = (event) => {
            this._pointerDownX = this.scene.pointerX;
            this._pointerDownY = this.scene.pointerY;
        };
        this.onPointerUp = (event) => {
            if (this.cameraMode === CameraMode.Ball || this.cameraMode === CameraMode.Landscape) {
                let dx = (this._pointerDownX - this.scene.pointerX);
                let dy = (this._pointerDownY - this.scene.pointerY);
                if (dx * dx + dy * dy > 10 * 10) {
                    this.setCameraMode(CameraMode.None);
                }
            }
            if (this.editMachineNameActive) {
                this.setEditMachineName(false);
            }
            if (this.editMachineAuthorActive) {
                this.setEditMachineAuthor(false);
            }
        };
        this.onWheelEvent = (event) => {
            if (this.cameraMode === CameraMode.Ball || this.cameraMode === CameraMode.Landscape) {
                this.targetCamRadiusFromWheel = true;
            }
        };
        this.editMachineNameActive = false;
        this.editMachineAuthorActive = false;
        this._curtainOpacity = 0;
        Game.Instance = this;
        this.canvas = document.getElementById(canvasElement);
        this.canvas.requestPointerLock = this.canvas.requestPointerLock || this.canvas.msRequestPointerLock || this.canvas.mozRequestPointerLock || this.canvas.webkitRequestPointerLock;
        this.canvasCurtain = document.getElementById("canvas-curtain");
        this.animateCurtainOpacity = Mummu.AnimationFactory.CreateNumber(this, this, "curtainOpacity");
        this.engine = new BABYLON.Engine(this.canvas, true, { audioEngine: true }, false);
        BABYLON.Engine.ShadersRepository = "./shaders/";
        I18NText.LangFilePath = "./datas/i18n/lang.csv";
        BABYLON.Engine.audioEngine.useCustomUnlockedButton = true;
        window.addEventListener("click", () => {
            if (!BABYLON.Engine.audioEngine.unlocked) {
                BABYLON.Engine.audioEngine.unlock();
            }
        }, { once: true });
        if (HasLocalStorage) {
            let savedMainSound = window.localStorage.getItem("saved-main-volume");
            if (savedMainSound) {
                let v = parseFloat(savedMainSound);
                if (isFinite(v)) {
                    BABYLON.Engine.audioEngine.setGlobalVolume(Math.max(Math.min(v, 1), 0));
                }
            }
            if (!BB_PUZZLE_ONLY) {
                let savedTimeFactor = window.localStorage.getItem("saved-time-factor");
                if (savedTimeFactor) {
                    let v = parseFloat(savedTimeFactor);
                    if (isFinite(v)) {
                        this.targetTimeFactor = Math.max(Math.min(v, 1), 0);
                    }
                }
            }
        }
    }
    getScene() {
        return this.scene;
    }
    get targetTimeFactor() {
        return this._targetTimeFactor;
    }
    set targetTimeFactor(v) {
        this._targetTimeFactor = Nabu.MinMax(v, 1 / 32, 1);
    }
    get currentTimeFactor() {
        if (this.mode === GameMode.Challenge) {
            if (this.challenge.mode === ChallengeMode.Parkour) {
                if (this.DEBUG_MODE) {
                    return Math.min(0.25, this.timeFactor);
                }
                return 0.25;
            }
        }
        if (this.mode === GameMode.Home || this.mode === GameMode.Page) {
            return Math.min(0.4, this.timeFactor);
        }
        if (this.cameraMode === CameraMode.FirstPersonBall) {
            return 0.5 * this.timeFactor;
        }
        return this.timeFactor;
    }
    getGraphicQ() {
        return this.config.getValue("graphicQ");
    }
    getGeometryQ() {
        let graphicQ = this.getGraphicQ();
        if (graphicQ === Core.GraphicQuality.Low) {
            return Core.GeometryQuality.Medium;
        }
        else if (graphicQ >= Core.GraphicQuality.Medium) {
            return Core.GeometryQuality.High;
        }
        return Core.GeometryQuality.Low;
    }
    getMaterialQ() {
        let graphicQ = this.getGraphicQ();
        if (graphicQ >= Core.GraphicQuality.High) {
            return Core.MaterialQuality.PBR;
        }
        return Core.MaterialQuality.Standard;
    }
    async createScene() {
        this.scene = new BABYLON.Scene(this.engine);
        //this.scene["_skipFrustumClipping"] = true;
        this.config = new MarbleConfiguration("marble-configuration", this);
        this.config.hasLocalStorage = HasLocalStorage;
        this.inputManager = new Nabu.InputManager(this.canvas, this.config);
        // Prevent any lib from trying to access gamepads.
        if (!this.inputManager.isGamepadAllowed) {
            navigator.getGamepads = () => { return []; };
        }
        this.config.initialize();
        if (HasLocalStorage) {
            if (!localStorage.getItem(this.config.configName)) {
                let lang = navigator.language;
                if (lang.startsWith("fr-")) {
                    this.config.setValue("lang", I18NTextLangs.French);
                }
                /*else if (lang.startsWith("pt-")) {
                    this.config.setValue("lang", I18NTextLangs.Portuguese);
                }*/
            }
            this.config.saveToLocalStorage();
        }
        this.config.getElement("lang").forceInit();
        this.inputManager.initialize();
        this.inputManager.initializeInputs(this.config);
        this.screenRatio = window.innerWidth / window.innerHeight;
        if (this.screenRatio < 1) {
            document.body.classList.add("vertical");
        }
        else {
            document.body.classList.remove("vertical");
        }
        this.vertexDataLoader = new Mummu.VertexDataLoader(this.scene);
        this.materials = new Core.MainMaterials(this, ExistingCountryFlags);
        if (this.DEBUG_MODE) {
            let debugPerf = new DebugPerf(this);
            debugPerf.initialize();
            debugPerf.show();
            BABYLON.CreateLineSystem("origin-cross", {
                lines: [
                    [new BABYLON.Vector3(-0.05, 0, 0), new BABYLON.Vector3(0.05, 0, 0)],
                    [new BABYLON.Vector3(0, -0.05, 0), new BABYLON.Vector3(0, 0.05, 0)],
                    [new BABYLON.Vector3(0, 0, -0.05), new BABYLON.Vector3(0, 0, 0.05)],
                ]
            }, this.scene);
        }
        else {
            this.scene.clearColor = BABYLON.Color4.FromHexString("#272B2EFF");
        }
        if (BB_PUZZLE_ONLY) {
            this.scene.clearColor = BABYLON.Color4.FromHexString("#00000000");
            document.body.style.backgroundColor = "#1488b6ff";
            //document.body.style.backgroundImage = "url(work/lab_background_test.jpg)";
            //document.body.style.backgroundSize = "cover";
        }
        //this.spotLight = new BABYLON.SpotLight("spot-light", new BABYLON.Vector3(0, 2, 0), new BABYLON.Vector3(0, -1, 0), Math.PI / 3, 1, this.scene);
        //this.spotLight.shadowMinZ = 1;
        //this.spotLight.shadowMaxZ = 3;
        //this.spotLight.includeOnlyWithLayerMask = 0x0FFFFFFF;
        this.directionalLight = new BABYLON.DirectionalLight("spot-light", new BABYLON.Vector3(0, -1, 0), this.scene);
        this.directionalLight.autoCalcShadowZBounds = true;
        this.directionalLight.includeOnlyWithLayerMask = 0x0FFFFFFF;
        this.arcCamera = new BABYLON.ArcRotateCamera("camera", this.targetCamAlpha, this.targetCamBeta, this.targetCamRadius, this.targetCamTarget.clone());
        this.arcCamera.layerMask = 0;
        this.arcCamera.minZ = 0.01;
        this.arcCamera.maxZ = 25;
        this.arcCamera.lowerBetaLimit = Math.PI / 180;
        this.arcCamera.upperBetaLimit = Math.PI * 0.55;
        this.arcCamera.lowerRadiusLimit = 0.15;
        this.arcCamera.upperRadiusLimit = 3;
        this.arcCamera.angularSensibilityX = 3000;
        this.arcCamera.angularSensibilityY = 3000;
        this.arcCamera.panningInertia *= 0.5;
        this.config.getElement("zoom-precision").forceInit();
        this.config.getElement("pan-precision").forceInit();
        this.ballCamera = new BallCamera(this);
        this.cameraTarget = BABYLON.MeshBuilder.CreateLineSystem("camera-target", {
            lines: [
                [new BABYLON.Vector3(-0.005, 0, 0), new BABYLON.Vector3(0.005, 0, 0)],
                [new BABYLON.Vector3(0, -0.005, 0), new BABYLON.Vector3(0, 0.005, 0)],
                [new BABYLON.Vector3(0, 0, -0.005), new BABYLON.Vector3(0, 0, 0.005)]
            ]
        }, this.scene);
        this.animateCamera = Mummu.AnimationFactory.CreateNumbers(this.arcCamera, this.arcCamera, ["alpha", "beta", "radius"], undefined, [true, true, false], Nabu.Easing.easeInOutSine);
        this.animateCameraTarget = Mummu.AnimationFactory.CreateVector3(this.arcCamera, this.arcCamera, "target", undefined, Nabu.Easing.easeInOutSine);
        this.updateCameraLayer();
        this.updateShadowGenerator();
        if (this.DEBUG_MODE) {
            if (window.localStorage.getItem("camera-target")) {
                let targetItem = JSON.parse(window.localStorage.getItem("camera-target"));
                let target = new BABYLON.Vector3(targetItem.x, targetItem.y, targetItem.z);
                if (Mummu.IsFinite(target)) {
                    this.arcCamera.target.x = target.x;
                    this.arcCamera.target.y = target.y;
                    this.arcCamera.target.z = target.z;
                }
            }
            if (window.localStorage.getItem("camera-position")) {
                let positionItem = JSON.parse(window.localStorage.getItem("camera-position"));
                let position = new BABYLON.Vector3(positionItem.x, positionItem.y, positionItem.z);
                if (Mummu.IsFinite(position)) {
                    this.arcCamera.setPosition(position);
                }
            }
        }
        this.arcCamera.attachControl();
        //this.movieMaker = new MovieMaker(this);
        //this.movieMaker.initialize();
        this.likeManager = new LikeManager(this);
        this.likeManager.initialize();
        this.offlineDatabase = new OfflineDatabase(this);
        this.devMode = new DevMode(this);
        this.devMode.initialize();
        this.machine = new Core.Machine(this);
        this.machine.graphicQ = this.getGraphicQ();
        let waitForMachineReady = () => {
            if (this.machine && this.machine.ready) {
                this.arcCamera.layerMask = 0x0FFFFFFF;
                this.updateCameraLayer();
            }
            else {
                requestAnimationFrame(waitForMachineReady);
            }
        };
        this.room = new Core.Room(this.machine, this);
        this.room.onRoomJustInstantiated = () => { this.updateCameraLayer(); };
        waitForMachineReady();
        let waitForMachineInstantiated = () => {
            if (this.machine && this.machine.ready /* && this.machine.instantiated*/) {
                document.body.addEventListener("touchstart", onFirstPlayerInteractionTouch);
                document.body.addEventListener("click", onFirstPlayerInteractionClic);
                document.body.addEventListener("keydown", onFirstPlayerInteractionKeyboard);
                if (USE_POKI_SDK) {
                    PokiSDK.gameLoadingFinished();
                }
                CanStartCommercialBreak = true;
            }
            else {
                requestAnimationFrame(waitForMachineInstantiated);
            }
        };
        waitForMachineInstantiated();
        if (!BB_PUZZLE_ONLY) {
            this.machineEditor = new MachineEditor(this);
        }
        if (this.DEBUG_USE_LOCAL_STORAGE) {
            let dataString = localStorage.getItem("last-saved-machine");
            if (dataString) {
                let data = JSON.parse(dataString);
                if (data) {
                    this.machine.deserialize(data);
                }
                else {
                    this.machine.deserialize(fallbackMachine);
                }
            }
            else {
                this.machine.deserialize(fallbackMachine);
            }
        }
        else {
            if (BB_PUZZLE_ONLY) {
                this.machine.deserialize(DefaultBBPuzzleTrack);
                this._targetTimeFactor = 0.8;
            }
            else {
                if (true) {
                    this.machine.deserialize(RandomDefault2DTrack());
                }
                else {
                    this.machine.deserialize(RandomDefault3DTrack());
                }
                let randomColor = Math.floor(Math.random() * MachineEditorPartColors.length);
                colorizeEntireMachine(this.machine, randomColor);
                this.machineEditor.lastSelectedColors[0] = randomColor;
            }
        }
        this.mode = GameMode.Home;
        if (!BB_PUZZLE_ONLY) {
            this.toolbar = new Toolbar(this);
            this.toolbar.initialize();
            this.toolbar.resize();
            this.topbar = new Topbar(this);
            this.topbar.initialize();
            this.topbar.resize();
        }
        this.shareMenuView = document.getElementsByTagName("share-menu")[0];
        this.shareMenuView.setGame(this);
        this.exportMenuView = document.getElementsByTagName("export-menu")[0];
        this.exportMenuView.setGame(this);
        this.constructionModeMenuView = document.getElementsByTagName("construction-mode-menu")[0];
        this.constructionModeMenuView.setGame(this);
        this.popupShade = document.querySelector("#pop-up-shade");
        this.popupShade.style.opacity = "0";
        this.popupShade.style.display = "none";
        this.popupShade.onclick = () => {
            this.constructionModeMenuView.hide(0.3);
            this.shareMenuView.hide(0.3);
            this.exportMenuView.hide(0.3);
            this.popupShade.style.opacity = "0";
            setTimeout(() => {
                this.popupShade.style.display = "none";
            }, 300);
        };
        this.materialPicker = document.getElementsByTagName("material-picker")[0];
        this.materialPicker.initPartMaterialButtons(this);
        this.ballMaterialPicker = document.getElementsByTagName("material-picker")[1];
        this.ballMaterialPicker.initBallMaterialButtons(this);
        if (BB_PUZZLE_ONLY) {
            this.bbPuzzlePerformanceManager = new BBPuzzlePerformanceManager(this);
            this.bbPuzzlePerformanceManager.initialize();
        }
        else {
            this.textHelpersManager = new TextHelpersManager(this);
            this.textHelpersManager.initialize();
        }
        this.challenge = new Challenge(this);
        this.autoPlayer = new AutoPlayer(this);
        this.bbPuzzleLoader = new BBPuzzlesLoader(this);
        this.bbPuzzle = new BlackBoardPuzzle(this);
        this.toonSoundManager = new ToonSoundManager(this);
        this.eulaPage = document.getElementById("eula-page");
        if (this.eulaPage) {
            this.eulaPage.onLoad = () => {
                document.getElementById("eula-return").onclick = () => {
                    this.shareMenuView.eulaCheckbox.value = 0;
                    this.eulaPage.hide(0.3);
                };
                document.getElementById("eula-accept").onclick = () => {
                    this.shareMenuView.eulaCheckbox.value = 1;
                    this.eulaPage.hide(0.3);
                };
            };
        }
        this.musicDisplay = new MusicDisplay(document.getElementById("music-display"), this);
        this.musicDisplay.reset();
        this.machine.onPlayCallbacks.push(() => {
            this.musicDisplay.reset();
            let xylophones = this.machine.decors.filter(decor => { return decor instanceof Core.Xylophone; });
            xylophones.forEach(xylophone => {
                xylophone.onSoundPlay = () => {
                    this.musicDisplay.drawNote(xylophone);
                };
            });
        });
        this.photoMaker = new PhotoMaker(this);
        this.videoMaker = new VideoMaker(this.canvas, {
            frameRate: 60,
            videoBitsPerSecond: 60 * this.canvas.width * this.canvas.height * 4,
            getAudioEngine: () => {
                return BABYLON.Engine.audioEngine;
            },
            getAudioElements: () => {
                let audioElements = [];
                if (this.ambientMusic) {
                    audioElements.push(this.ambientMusic);
                }
                return audioElements;
            }
        });
        await this.checkLiveServiceAvailability();
        this.router = new MarbleRouter(this);
        this.router.initialize();
        await this.router.waitForAllPagesLoaded();
        if (this.OFFLINE_MODE) {
            const __communityPanel = this.router.homeMenu.page.querySelector(".community");
            if (__communityPanel) __communityPanel.style.display = "none";
        }
        this.router.optionsPage.setConfiguration(this.config);
        this.router.optionsPage.titleElement.innerHTML = '<i18n-text text-key="options-title"></i18n-text>';
        this.router.optionsPage.backButton.innerHTML = '<i18n-text text-key="btn-back"></i18n-text>';
        this.router.homeMenu.page.querySelectorAll(".editor").forEach(e => {
            if (e instanceof HTMLElement) {
                e.onclick = () => {
                    this.constructionModeMenuView.show();
                };
            }
        });
        this.router.homeMenu.initializeChallengeMenuPageProgress();
        this.room.setRoomIndex(this.room.contextualRoomIndex(this.machine.roomIndex, this.machine.graphicQ), true);
        // If you are going to home page, but have never played the tutorial, get sent to Tutorial.
        if (USE_POKI_SDK) {
            let pokiMachineId = PokiSDK.getURLParam("machineId");
            if (pokiMachineId === "" && location.hash === "" && !(this.completedChallenges.tutorial[0] === 1)) {
                location.hash = "#tutorial-1";
            }
            else if (isFinite(pokiMachineId) && pokiMachineId > 0) {
                location.href = "#machine?id=" + pokiMachineId;
            }
        }
        /*
        let arrow = new SvgArrow("test", this, 0.3, 0.2, - 45);
        arrow.instantiate();
        setTimeout(() => {
            arrow.setTarget(document.querySelector("panel-element"));
            arrow.show();
        }, 2000);
        */
        this.router.start();
        let alternateMenuCamMode = () => {
            if (this.menuCameraMode === CameraMode.Ball) {
                this.menuCameraMode = CameraMode.Landscape;
            }
            else {
                this.menuCameraMode = CameraMode.Ball;
            }
            if (this.mode <= GameMode.Page) {
                this.setCameraMode(this.menuCameraMode);
            }
            setTimeout(alternateMenuCamMode, 10000 + 10000 * Math.random());
        };
        alternateMenuCamMode();
        if (location.host.startsWith("127.0.0.1")) {
            document.addEventListener("keydown", async (event) => {
                //await this.makeScreenshot("wall-3.3");
                //await this.makeScreenshot("split");
                if (event.ctrlKey && event.code === "BracketRight") {
                    this.makeMachinePartsMiniatures();
                }
                if (event.ctrlKey && event.code === "Quote") {
                    if (this.videoMaker.isRecording) {
                        this.videoMaker.stopRecording().then(() => {
                            this.videoMaker.saveRecording();
                        });
                    }
                    else {
                        this.videoMaker.startRecording();
                    }
                }
            });
        }
        if (BB_PUZZLE_ONLY) {
            this.ambientMusic = document.createElement("audio");
            this.ambientMusic.src = "datas/sounds-bb/Origami.mp3";
            this.ambientMusic.loop = true;
            this.ambientMusic.volume = 0.2;
        }
        this.canvas.addEventListener("pointerdown", this.onPointerDown);
        this.canvas.addEventListener("pointerup", this.onPointerUp);
        this.canvas.addEventListener("wheel", this.onWheelEvent);
        document.querySelector("#machine-title").addEventListener("pointerdown", StopPointerProgatation);
        document.querySelector("#machine-title").addEventListener("pointermove", StopPointerProgatation);
        document.querySelector("#machine-title").addEventListener("pointerup", StopPointerProgatationAndMonkeys);
    }
    animate() {
        this.engine.runRenderLoop(() => {
            this.scene.render();
            this.update();
        });
        window.onresize = this.onResize;
        if (screen && screen.orientation) {
            screen.orientation.onchange = this.onResize;
        }
    }
    async initialize() {
    }
    update() {
        let rawDT = this.scene.deltaTime / 1000;
        let timeFactoredDT = rawDT * this.currentTimeFactor;
        if (isFinite(timeFactoredDT)) {
            this.factoredTimeSinceGameStart += timeFactoredDT;
        }
        if (this.DEBUG_MODE) {
            let camPos = this.arcCamera.position.clone();
            let camTarget = this.arcCamera.target.clone();
            if (HasLocalStorage) {
                camPos.x = Nabu.MinMax(camPos.x, -3, 3);
                camPos.y = Nabu.MinMax(camPos.y, -3, 3);
                camPos.z = Nabu.MinMax(camPos.z, -3, 3);
                camTarget.x = Nabu.MinMax(camTarget.x, -3, 3);
                camTarget.y = Nabu.MinMax(camTarget.y, -3, 3);
                camTarget.z = Nabu.MinMax(camTarget.z, -3, 3);
                window.localStorage.setItem("camera-position", JSON.stringify({ x: camPos.x, y: camPos.y, z: camPos.z }));
                window.localStorage.setItem("camera-target", JSON.stringify({ x: camTarget.x, y: camTarget.y, z: camTarget.z }));
            }
        }
        if (this.cameraMode === CameraMode.None && this.mode === GameMode.Create && this.machineEditor && this.machineEditor.is3DMode) {
            this.cameraTarget.position.copyFrom(this.arcCamera.target);
            this.cameraTarget.isVisible = true;
        }
        else {
            this.cameraTarget.isVisible = false;
        }
        if (this.arcCamera.alpha < -Math.PI) {
            this.arcCamera.alpha += 2 * Math.PI;
        }
        if (this.arcCamera.alpha > Math.PI) {
            this.arcCamera.alpha -= 2 * Math.PI;
        }
        if (isFinite(rawDT) && this.cameraMode >= CameraMode.Movie && this.cameraMode <= CameraMode.MovieIdle) {
            let viewpoint = this.movieMaker.viewpoints[this.movieMaker.currentIndex];
            BABYLON.Vector3.LerpToRef(this.arcCamera.target, viewpoint.target, 1 - Nabu.Easing.smooth3Sec(1 / rawDT), this.arcCamera.target);
            if (BABYLON.Vector3.Distance(this.arcCamera.position, viewpoint.pos) < 0.03 && this.cameraMode === CameraMode.Movie) {
                this.cameraMode = CameraMode.MovieIdle;
                this.movieIdleDir = BABYLON.Vector3.Lerp(this.arcCamera.position, viewpoint.pos, 1 - Nabu.Easing.smooth3Sec(1 / rawDT)).subtract(this.arcCamera.position);
            }
            if (this.cameraMode === CameraMode.MovieIdle) {
                this.arcCamera.setPosition(this.arcCamera.position.add(this.movieIdleDir));
            }
            else {
                this.arcCamera.setPosition(BABYLON.Vector3.Lerp(this.arcCamera.position, viewpoint.pos, 1 - Nabu.Easing.smooth3Sec(1 / rawDT)));
            }
        }
        else if (isFinite(rawDT) && (this.cameraMode === CameraMode.FirstPersonBall || this.cameraMode === CameraMode.SideViewBall)) {
        }
        else if (this.cameraMode === CameraMode.None) {
            if (this.mode === GameMode.Create && this.machineEditor && this.machineEditor.is2DMode) {
                this.arcCamera.alpha = -0.5 * Math.PI;
                this.arcCamera.beta = 0.4 * Math.PI;
                this.arcCamera.target.z = 0;
            }
            else if (this.mode === GameMode.BBPuzzle) {
                this.arcCamera.alpha = -0.5 * Math.PI;
                this.arcCamera.beta = 0.45 * Math.PI;
                this.arcCamera.target.z = 0;
            }
        }
        else if (this.cameraMode > CameraMode.None && this.cameraMode != CameraMode.Selected && isFinite(rawDT)) {
            let speed = 0.01;
            let camTarget = this.targetCamTarget;
            if (this.cameraMode === CameraMode.Ball && this.machine && this.machine.balls && this.machine.balls[0]) {
                this._trackTargetCamSpeed = this._trackTargetCamSpeed * 0.9995 + 30 * 0.0005;
                camTarget = this.machine.balls[0].position;
            }
            else if (this.cameraMode >= CameraMode.Focusing && this.cameraMode <= CameraMode.Transition) {
                this._trackTargetCamSpeed = this._trackTargetCamSpeed * 0.995 + 20 * 0.005;
                speed = 0.5;
            }
            else {
                this._trackTargetCamSpeed = 0.2;
            }
            let target = BABYLON.Vector3.Lerp(this.arcCamera.target, camTarget, this._trackTargetCamSpeed * rawDT);
            let alpha = Nabu.Step(this.arcCamera.alpha, this.targetCamAlpha, Math.PI * speed * rawDT);
            let beta = Nabu.Step(this.arcCamera.beta, this.targetCamBeta, Math.PI * speed * rawDT);
            let radius = Nabu.Step(this.arcCamera.radius, this.targetCamRadius, 20 * speed * rawDT);
            this.arcCamera.target.copyFrom(target);
            this.arcCamera.alpha = alpha;
            this.arcCamera.beta = beta;
            if (!this.targetCamRadiusFromWheel) {
                this.arcCamera.radius = radius;
            }
            else {
                this.targetCamRadius = this.arcCamera.radius;
            }
            if (this.cameraMode >= CameraMode.Focusing) {
                if (Math.abs(this.arcCamera.alpha - this.targetCamAlpha) < Math.PI / 180) {
                    if (Math.abs(this.arcCamera.beta - this.targetCamBeta) < Math.PI / 180) {
                        if (Math.abs(this.arcCamera.radius - this.targetCamRadius) < 0.001) {
                            if (BABYLON.Vector3.Distance(this.arcCamera.target, this.targetCamTarget) < 0.001) {
                                if (this.cameraMode === CameraMode.FocusingSelected) {
                                    this.cameraMode = CameraMode.Selected;
                                    this.arcCamera.attachControl();
                                }
                                else {
                                    this.cameraMode = CameraMode.None;
                                    this.arcCamera.attachControl();
                                }
                            }
                        }
                    }
                }
            }
            else if (this.cameraMode <= CameraMode.Landscape) {
                if (Math.abs(this.arcCamera.alpha - this.targetCamAlpha) < Math.PI / 180) {
                    this.targetCamAlpha = this.randomLandscapeTargetAlpha();
                }
                if (Math.abs(this.arcCamera.beta - this.targetCamBeta) < Math.PI / 180) {
                    this.targetCamBeta = this.randomLandscapeTargetBeta();
                }
            }
        }
        if (!this.DEBUG_MODE) {
            if (this.arcCamera.target.x < this.machine.baseMeshMinX) {
                if (this.arcCamera.target.x < this._lastCameraTarget.x) {
                    this.arcCamera.target.x = this._lastCameraTarget.x;
                }
            }
            if (this.arcCamera.target.x > this.machine.baseMeshMaxX) {
                if (this.arcCamera.target.x > this._lastCameraTarget.x) {
                    this.arcCamera.target.x = this._lastCameraTarget.x;
                }
            }
            if (this.arcCamera.target.y < this.machine.baseMeshMinY) {
                if (this.arcCamera.target.y < this._lastCameraTarget.y) {
                    this.arcCamera.target.y = this._lastCameraTarget.y;
                }
            }
            if (this.arcCamera.target.y > this.machine.baseMeshMaxY) {
                if (this.arcCamera.target.y > this._lastCameraTarget.y) {
                    this.arcCamera.target.y = this._lastCameraTarget.y;
                }
            }
            if (this.arcCamera.target.z < this.machine.baseMeshMinZ) {
                if (this.arcCamera.target.z < this._lastCameraTarget.z) {
                    this.arcCamera.target.z = this._lastCameraTarget.z;
                }
            }
            if (this.arcCamera.target.z > this.machine.baseMeshMaxZ) {
                if (this.arcCamera.target.z > this._lastCameraTarget.z) {
                    this.arcCamera.target.z = this._lastCameraTarget.z;
                }
            }
            this._lastCameraTarget.copyFrom(this.arcCamera.target);
        }
        if (HasLocalStorage) {
            window.localStorage.setItem("saved-main-volume", BABYLON.Engine.audioEngine.getGlobalVolume().toFixed(2));
            window.localStorage.setItem("saved-time-factor", this.targetTimeFactor.toFixed(2));
        }
        if (this.cameraOrtho) {
            let f = this.arcCamera.radius / 4;
            this.arcCamera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
            this.arcCamera.orthoTop = 1 * f;
            this.arcCamera.orthoBottom = -1 * f;
            this.arcCamera.orthoLeft = -this.screenRatio * f;
            this.arcCamera.orthoRight = this.screenRatio * f;
        }
        else {
            this.arcCamera.mode = BABYLON.Camera.PERSPECTIVE_CAMERA;
        }
        if (this.machineEditor) {
            if (isFinite(rawDT)) {
                if (this.mode === GameMode.Challenge && (this.challenge.mode === ChallengeMode.Tutorial || this.challenge.mode === ChallengeMode.Puzzle) || this.mode === GameMode.Create) {
                    this.machineEditor.update(rawDT);
                }
            }
        }
        if (this.machine) {
            this.machine.update();
        }
        if (this.challenge && this.mode === GameMode.Challenge) {
            this.challenge.update(rawDT);
        }
        if (this.autoPlayer) {
            this.autoPlayer.update(rawDT);
        }
        if (this.bbPuzzle && this.mode === GameMode.BBPuzzle) {
            this.bbPuzzle.update(rawDT);
        }
        if (this.toonSoundManager) {
            this.toonSoundManager.update(rawDT);
        }
        if (isFinite(rawDT) && this.textHelpersManager) {
            this.textHelpersManager.update(rawDT);
        }
        if (isFinite(rawDT) && this.bbPuzzlePerformanceManager) {
            this.bbPuzzlePerformanceManager.update(rawDT);
        }
        if (this.ballCamera && this.ballCamera.isActive) {
            this.ballCamera.ballCameraUpdate(rawDT);
        }
        let fps = 1 / rawDT;
        if (isFinite(fps)) {
            if (fps < 24 && this.timeFactor > this.targetTimeFactor / 2) {
                this.timeFactor *= 0.99;
            }
            else {
                this.timeFactor = this.timeFactor * 0.99 + this.targetTimeFactor * 0.01;
            }
        }
        if (!BB_PUZZLE_ONLY) {
            // v Not optimized but very stable.
            let machineEditorContainerIsDisplayed = this.machineEditor && this.machineEditor.container && this.machineEditor.container.style.display === "block";
            let machineEditorContainerHeight = -1;
            if (machineEditorContainerIsDisplayed) {
                machineEditorContainerHeight = this.machineEditor.container.getBoundingClientRect().height;
            }
            let machineEditorContainerWidth = -1;
            if (machineEditorContainerIsDisplayed) {
                machineEditorContainerWidth = this.machineEditor.container.getBoundingClientRect().width;
            }
            if (machineEditorContainerIsDisplayed != this.machineEditorContainerIsDisplayed || machineEditorContainerWidth != this.machineEditorContainerWidth || machineEditorContainerHeight != this.machineEditorContainerHeight) {
                this.onResize();
            }
            this.machineEditorContainerIsDisplayed = machineEditorContainerIsDisplayed;
            this.machineEditorContainerWidth = machineEditorContainerWidth;
            this.machineEditorContainerHeight = machineEditorContainerHeight;
            // ^ Not optimized but very stable.
        }
    }
    resizeCanvas() {
        this.canvas.style.right = "";
        this.canvas.style.top = "";
        if (this.photoMaker.activated && this.photoMaker.mode === 1) {
            if (this.screenRatio >= 1) {
                this.canvas.style.width = (window.innerHeight).toFixed(0) + "px";
                this.canvas.style.right = (window.innerWidth * 0.5 - window.innerHeight * 0.5).toFixed(0) + "px";
                this.canvas.style.height = (window.innerHeight).toFixed(0) + "px";
            }
            if (this.screenRatio < 1) {
                this.canvas.style.width = (window.innerWidth).toFixed(0) + "px";
                this.canvas.style.height = (window.innerWidth).toFixed(0) + "px";
                this.canvas.style.top = (window.innerHeight * 0.5 - window.innerWidth * 0.5).toFixed(0) + "px";
            }
        }
        else if (this.machineEditor && this.machineEditor.container && this.machineEditor.container.style.display === "block") {
            if (this.screenRatio >= 1) {
                let containerW = this.machineEditor.container.getBoundingClientRect().width;
                this.canvas.style.width = (window.innerWidth - containerW).toFixed(0) + "px";
                this.canvas.style.height = "100%";
                this.musicDisplay.canvas.style.width = ((window.innerWidth - containerW) * 0.8).toFixed(0) + "px";
                this.musicDisplay.canvas.style.bottom = "100px";
                this.musicDisplay.canvas.style.left = (this.canvasLeft + this.canvas.getBoundingClientRect().width * 0.1) + "px";
            }
            if (this.screenRatio < 1) {
                let containerH = this.machineEditor.container.getBoundingClientRect().height;
                this.canvas.style.width = "100%";
                this.canvas.style.height = (window.innerHeight - containerH).toFixed(0) + "px";
                this.musicDisplay.canvas.style.width = "80%";
                this.musicDisplay.canvas.style.left = "10%";
                this.musicDisplay.canvas.style.bottom = ((document.body.getBoundingClientRect().height - this.canvas.getBoundingClientRect().height) + 100) + "px";
            }
        }
        else {
            this.canvas.style.width = "100%";
            this.canvas.style.height = "100%";
            this.musicDisplay.canvas.style.width = undefined;
            this.musicDisplay.canvas.style.bottom = undefined;
            this.musicDisplay.canvas.style.left = undefined;
        }
        let rect = this.canvas.getBoundingClientRect();
        if (this.photoMaker.activated && this.photoMaker.mode === 1) {
            this.canvas.setAttribute("width", this.photoMaker.videoRes.toFixed(0));
            this.canvas.setAttribute("height", this.photoMaker.videoRes.toFixed(0));
        }
        else {
            this.canvas.setAttribute("width", Math.floor(rect.width * window.devicePixelRatio).toFixed(0));
            this.canvas.setAttribute("height", Math.floor(rect.height * window.devicePixelRatio).toFixed(0));
        }
        this.canvasLeft = rect.left;
        let screenshotFrame = document.getElementById("screenshot-frame");
        if (this.screenRatio > 1) {
            screenshotFrame.style.left = (rect.left + (rect.width * window.devicePixelRatio - rect.height * window.devicePixelRatio) * 0.5).toFixed(0) + "px";
        }
        else {
            screenshotFrame.style.left = "";
        }
        let machineTile = document.getElementById("machine-title");
        if (this.screenRatio >= 1) {
            if (machineTile) {
                machineTile.classList.remove("vertical");
            }
            if (this.machineEditor && this.machineEditor.machinePartEditorMenu && this.machineEditor.machinePartEditorMenu.container) {
                this.machineEditor.machinePartEditorMenu.container.classList.remove("vertical");
            }
            if (this.topbar) {
                this.topbar.container.classList.remove("vertical");
            }
        }
        else {
            if (machineTile) {
                machineTile.classList.add("vertical");
            }
            if (this.machineEditor && this.machineEditor.machinePartEditorMenu && this.machineEditor.machinePartEditorMenu.container) {
                this.machineEditor.machinePartEditorMenu.container.classList.add("vertical");
            }
            if (this.topbar && this.topbar.container) {
                this.topbar.container.classList.add("vertical");
            }
        }
        if (this.topbar && this.topbar.container) {
            if (IsMobile === 1) {
                this.topbar.container.classList.add("mobile");
            }
            else {
                this.topbar.container.classList.remove("mobile");
            }
        }
        if (this.machineEditor && this.machineEditor.container) {
            if (IsMobile === 1) {
                this.machineEditor.container.classList.add("mobile");
            }
            else {
                this.machineEditor.container.classList.remove("mobile");
            }
        }
    }
    makeMachinePartsMiniatures() {
        let orthoCamera = new BABYLON.ArcRotateCamera("camera", 0, Math.PI / 3, 20, new BABYLON.Vector3(0, 10, 0));
        orthoCamera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        orthoCamera.speed = 0.2;
        orthoCamera.minZ = 0.1;
        this.scene.activeCameras = [orthoCamera];
        orthoCamera.attachControl();
        this.canvas.width = 256;
        this.canvas.height = 256;
        this.canvas.style.top = "calc((100vh - 256px) * 0.5)";
        this.canvas.style.left = "calc((100vw - 256px) * 0.5)";
        this.canvas.style.width = "256px";
        this.canvas.style.height = "256px";
        this.engine.resize();
        this.machine.setBaseIsVisible(false);
        if (this.room) {
            this.room.setGroundHeight(100);
            this.room.skybox.isVisible = false;
        }
        this.scene.clearColor = BABYLON.Color4.FromHexString("#272B2EFF");
        requestAnimationFrame(async () => {
            this.engine.resize();
            this.screenRatio = this.engine.getRenderWidth() / this.engine.getRenderHeight();
            orthoCamera.setTarget(BABYLON.Vector3.Zero());
            let parts = MachineEditorPartsList.map(e => { return e.part; });
            MachineEditorPartsListDebug.forEach(e => {
                //parts.push(e.part);
            });
            //parts = [];
            for (let i = 1; i <= this.router.homeMenu.tutorialCount; i++) {
                let tutorialIndex = TutorialsList[i - 1];
                let dataResponse = await fetch("./datas/challenges/tutorial-" + tutorialIndex + ".json");
                if (dataResponse && dataResponse.status === 200) {
                    let data = (await dataResponse.json());
                    data.elements.forEach(element => {
                        if (parts.indexOf(element) === -1) {
                            //parts.push(element);
                        }
                    });
                }
            }
            for (let i = 1; i <= this.router.homeMenu.arcadeCount; i++) {
                let dataResponse = await fetch("./datas/challenges/puzzle-" + i.toFixed() + ".json");
                if (dataResponse && dataResponse.status === 200) {
                    let data = (await dataResponse.json());
                    data.elements.forEach(element => {
                        if (parts.indexOf(element) === -1) {
                            //parts.push(element);
                        }
                    });
                }
            }
            parts = ["coil_5.3", "sort"];
            let doMinis = async () => {
                for (let i = 0; i < parts.length; i++) {
                    await this.makeMachinePartScreenshot(orthoCamera, parts[i], i === parts.length - 1);
                }
            };
            doMinis();
        });
    }
    makePetsMiniatures() {
        let orthoCamera = new BABYLON.ArcRotateCamera("camera", 0, Math.PI / 3, 20, new BABYLON.Vector3(0, 10, 0));
        orthoCamera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        orthoCamera.speed = 0.2;
        orthoCamera.minZ = 0.1;
        this.scene.activeCameras = [orthoCamera];
        orthoCamera.attachControl();
        this.canvas.width = 256;
        this.canvas.height = 256;
        this.canvas.style.top = "calc((100vh - 256px) * 0.5)";
        this.canvas.style.left = "calc((100vw - 256px) * 0.5)";
        this.canvas.style.width = "256px";
        this.canvas.style.height = "256px";
        this.engine.resize();
        this.machine.setBaseIsVisible(false);
        if (this.room) {
            this.room.setGroundHeight(100);
            this.room.skybox.isVisible = false;
        }
        this.scene.clearColor = BABYLON.Color4.FromHexString("#272B2EFF");
        requestAnimationFrame(async () => {
            this.engine.resize();
            this.screenRatio = this.engine.getRenderWidth() / this.engine.getRenderHeight();
            orthoCamera.setTarget(BABYLON.Vector3.Zero());
            let doMinis = async () => {
                for (let i = 0; i < BB_PUZZLE_PETS_GIFTS.length; i++) {
                    await this.makePetScreenshot(orthoCamera, BB_PUZZLE_PETS_GIFTS[i]);
                }
            };
            doMinis();
        });
    }
    async makePetScreenshot(orthoCamera, petName) {
        this.scene.clearColor = BABYLON.Color4.FromHexString("#00000000");
        return new Promise(resolve => {
            requestAnimationFrame(async () => {
                this.machine.stop();
                this.machine.dispose();
                let petMesh = new BABYLON.Mesh("pet-mesh", this.scene);
                petMesh.rotation.y = Math.PI;
                let petMeshParts = await BABYLON.SceneLoader.ImportMeshAsync("", "datas/meshes-bb/" + petName + ".obj");
                petMeshParts.meshes.forEach(mesh => {
                    mesh.parent = petMesh;
                    if (mesh instanceof BABYLON.Mesh) {
                        let vData = BABYLON.VertexData.ExtractFromMesh(mesh);
                        Mummu.ScaleVertexDataInPlace(vData, 0.06);
                        vData.applyToMesh(mesh);
                        Core.MainMaterials.SetAsOutlinedMesh(mesh);
                        mesh.material = this.bbPuzzle.bbPuzzlePet.petMaterial;
                    }
                });
                let w = Core.tileSize * 3.6;
                let d = Core.tileSize * 3.6;
                let h = Core.tileSize * 3.6;
                orthoCamera.setTarget(new BABYLON.Vector3(0, Core.tileSize * 1.8, 0));
                orthoCamera.radius = 20;
                orthoCamera.alpha = -Math.PI / 3;
                orthoCamera.beta = Math.PI / 3;
                let hAngle = Math.PI * 0.5 + orthoCamera.alpha;
                let vAngle = Math.PI * 0.5 - orthoCamera.beta;
                let halfCamMinW = d * 0.5 * Math.sin(hAngle) + w * 0.5 * Math.cos(hAngle);
                let halfCamMinH = h * 0.5 * Math.cos(vAngle) + d * 0.5 * Math.cos(hAngle) * Math.sin(vAngle) + w * 0.5 * Math.sin(hAngle) * Math.sin(vAngle);
                let f = 1.1;
                if (halfCamMinW >= halfCamMinH) {
                    orthoCamera.orthoTop = halfCamMinW * f;
                    orthoCamera.orthoBottom = -halfCamMinW * f;
                    orthoCamera.orthoLeft = -halfCamMinW * f;
                    orthoCamera.orthoRight = halfCamMinW * f;
                }
                else {
                    orthoCamera.orthoTop = halfCamMinH * f;
                    orthoCamera.orthoBottom = -halfCamMinH * f;
                    orthoCamera.orthoLeft = -halfCamMinH * f;
                    orthoCamera.orthoRight = halfCamMinH * f;
                }
                this.machine.setBaseIsVisible(false);
                if (this.room) {
                    this.room.skybox.isVisible = false;
                }
                setTimeout(async () => {
                    let canvas = await Mummu.MakeScreenshot({ miniatureName: petName, size: 256 });
                    petMesh.dispose();
                    var tmpLink = document.createElement('a');
                    tmpLink.download = petName + ".png";
                    tmpLink.href = canvas.toDataURL();
                    document.body.appendChild(tmpLink);
                    tmpLink.click();
                    document.body.removeChild(tmpLink);
                    resolve();
                }, 300);
            });
        });
    }
    async makeMachinePartScreenshot(orthoCamera, partName, debugNoDelete = false) {
        this.scene.clearColor = BABYLON.Color4.FromHexString("#272B2EFF");
        return new Promise(resolve => {
            requestAnimationFrame(async () => {
                this.machine.stop();
                this.machine.dispose();
                let track;
                let mirrorX = false;
                let r = 0;
                if (partName.endsWith("[R]1")) {
                    r = 1;
                }
                if (partName.endsWith("[R]2")) {
                    r = 2;
                }
                if (partName.endsWith("[R]3")) {
                    r = 3;
                }
                if (partName.startsWith("wall")) {
                    mirrorX = true;
                }
                track = this.machine.trackFactory.createTrack(partName.split("[R]")[0], {
                    i: 0,
                    j: 0,
                    k: 0,
                    r: r,
                    mirrorX: mirrorX
                });
                track.sleepersMeshProp = {};
                if (track) {
                    this.machine.parts = [track];
                }
                await this.machine.instantiate();
                //this.machine.exitShooter.setIsVisible(false);
                //this.machine.exitTrack.setIsVisible(false);
                //this.machine.exitHoleIn.isVisible = false;
                //this.machine.exitHoleOut.isVisible = false;
                //this.updateMachineAuthorAndName();
                let x0 = track.worldAABBMin.x;
                let y1 = track.worldAABBMax.y;
                let z1 = track.worldAABBMax.z;
                let x1 = track.worldAABBMax.x;
                let y0 = track.worldAABBMin.y;
                let z0 = track.worldAABBMin.z;
                let w = track.worldAABBMax.x - track.worldAABBMin.x;
                let h = track.worldAABBMax.y - track.worldAABBMin.y;
                let d = track.worldAABBMax.z - track.worldAABBMin.z;
                let encloseMat = new BABYLON.StandardMaterial("white-autolit-material");
                encloseMat.diffuseColor = BABYLON.Color3.Black();
                encloseMat.emissiveColor = BABYLON.Color3.FromHexString("#272B2E").scaleInPlace(1.3);
                encloseMat.specularColor.copyFromFloats(0, 0, 0);
                let encloseMesh = new BABYLON.Mesh("test");
                encloseMesh.parent = track;
                let makeCapsuleFromTo = (from, to) => {
                    let l = BABYLON.Vector3.Distance(from, to);
                    let capsule = BABYLON.MeshBuilder.CreateCapsule("capsule", { radius: 0.0005, height: l + 0.001 });
                    capsule.material = encloseMat;
                    capsule.rotationQuaternion = Mummu.QuaternionFromYZAxis(to.subtract(from), BABYLON.Vector3.One());
                    capsule.position.copyFrom(from).addInPlace(to).scaleInPlace(0.5);
                    capsule.parent = encloseMesh;
                };
                makeCapsuleFromTo(new BABYLON.Vector3(x0, y0, z0), new BABYLON.Vector3(x1, y0, z0));
                makeCapsuleFromTo(new BABYLON.Vector3(x1, y0, z0), new BABYLON.Vector3(x1, y0, z1));
                makeCapsuleFromTo(new BABYLON.Vector3(x1, y0, z1), new BABYLON.Vector3(x0, y0, z1));
                makeCapsuleFromTo(new BABYLON.Vector3(x0, y0, z1), new BABYLON.Vector3(x0, y0, z0));
                makeCapsuleFromTo(new BABYLON.Vector3(x0, y0, z0), new BABYLON.Vector3(x0, y1, z0));
                makeCapsuleFromTo(new BABYLON.Vector3(x0, y1, z0), new BABYLON.Vector3(x0, y1, z1));
                makeCapsuleFromTo(new BABYLON.Vector3(x0, y1, z1), new BABYLON.Vector3(x0, y0, z1));
                for (let i = 1; i < track.w; i++) {
                    makeCapsuleFromTo(new BABYLON.Vector3(x0 + i * Core.tileWidth, y0, z0), new BABYLON.Vector3(x0 + i * Core.tileWidth, y0, z1));
                }
                for (let j = 1; j < (track.h + 1); j++) {
                    makeCapsuleFromTo(new BABYLON.Vector3(x0, y0 + j * Core.tileHeight, z0), new BABYLON.Vector3(x0, y0 + j * Core.tileHeight, z1));
                }
                for (let k = 1; k < track.d; k++) {
                    makeCapsuleFromTo(new BABYLON.Vector3(x0, y0, z0 + k * Core.tileDepth), new BABYLON.Vector3(x0, y1, z0 + k * Core.tileDepth));
                    makeCapsuleFromTo(new BABYLON.Vector3(x0, y0, z0 + k * Core.tileDepth), new BABYLON.Vector3(x1, y0, z0 + k * Core.tileDepth));
                }
                orthoCamera.setTarget(new BABYLON.Vector3(x0 + x1, y0 + y1, z0 + z1).scaleInPlace(0.5));
                orthoCamera.radius = 20;
                orthoCamera.alpha = -Math.PI / 3;
                orthoCamera.beta = Math.PI / 3;
                let hAngle = Math.PI * 0.5 + orthoCamera.alpha;
                let vAngle = Math.PI * 0.5 - orthoCamera.beta;
                let halfCamMinW = d * 0.5 * Math.sin(hAngle) + w * 0.5 * Math.cos(hAngle);
                let halfCamMinH = h * 0.5 * Math.cos(vAngle) + d * 0.5 * Math.cos(hAngle) * Math.sin(vAngle) + w * 0.5 * Math.sin(hAngle) * Math.sin(vAngle);
                let f = 1.1;
                if (halfCamMinW >= halfCamMinH) {
                    orthoCamera.orthoTop = halfCamMinW * f;
                    orthoCamera.orthoBottom = -halfCamMinW * f;
                    orthoCamera.orthoLeft = -halfCamMinW * f;
                    orthoCamera.orthoRight = halfCamMinW * f;
                }
                else {
                    orthoCamera.orthoTop = halfCamMinH * f;
                    orthoCamera.orthoBottom = -halfCamMinH * f;
                    orthoCamera.orthoLeft = -halfCamMinH * f;
                    orthoCamera.orthoRight = halfCamMinH * f;
                }
                this.machine.setBaseIsVisible(false);
                if (this.room) {
                    this.room.skybox.isVisible = false;
                }
                setTimeout(async () => {
                    let canvas = await Mummu.MakeScreenshot({ miniatureName: partName, size: 256 });
                    var tmpLink = document.createElement('a');
                    tmpLink.download = partName + ".png";
                    tmpLink.href = canvas.toDataURL();
                    document.body.appendChild(tmpLink);
                    tmpLink.click();
                    document.body.removeChild(tmpLink);
                    resolve();
                }, 300);
            });
        });
    }
    async makeCircuitScreenshot(size = 512, noBackground = false, noText = false) {
        if (noBackground) {
            this.machine.setBaseIsVisible(false);
            if (this.room) {
                this.room.skybox.isVisible = false;
            }
            this.room.animateHide(0);
            this.scene.clearColor.copyFromFloats(0, 0, 0, 0);
            if (this.machine.exitShooter) {
                this.machine.exitShooter.setIsVisible(false);
                this.machine.exitTrack.setIsVisible(false);
                this.machine.exitHoleIn.isVisible = false;
                this.machine.exitHoleOut.isVisible = false;
            }
            this.machine.parts.forEach(part => {
                part.sleepersMeshProp = {};
                part.doSleepersMeshUpdate();
            });
        }
        return new Promise(resolve => {
            requestAnimationFrame(async () => {
                let picName = this.machine.name;
                if (location.hash.startsWith("#machine?id=")) {
                    picName = location.hash.replace("#machine?id=", "") + "_" + this.machine.name + "_" + size.toFixed(0) + "p";
                }
                else if (location.hash.startsWith("#demo-")) {
                    picName = location.hash.replace("#demo-", "");
                }
                let canvasW = this.canvas.getAttribute("width");
                let canvasH = this.canvas.getAttribute("height");
                if (this.screenRatio > 1) {
                    this.canvas.setAttribute("width", (size * this.screenRatio).toFixed(0));
                    this.canvas.setAttribute("height", size.toFixed(0));
                }
                else {
                    this.canvas.setAttribute("width", size.toFixed(0));
                    this.canvas.setAttribute("height", (size / this.screenRatio).toFixed(0));
                }
                let picCanvas = await Mummu.MakeScreenshot({ miniatureName: picName, size: size, outlineWidth: 0 });
                if (noBackground) {
                    this.machine.setBaseIsVisible(true);
                    if (this.room) {
                        this.room.skybox.isVisible = true;
                    }
                    this.room.animateShow(0);
                    if (this.machine.exitShooter) {
                        this.machine.exitShooter.setIsVisible(true);
                        this.machine.exitTrack.setIsVisible(true);
                        this.machine.exitHoleIn.isVisible = true;
                        this.machine.exitHoleOut.isVisible = true;
                    }
                    this.machine.parts.forEach(part => {
                        part.sleepersMeshProp = this.machine.sleepersMeshProp;
                        part.doSleepersMeshUpdate();
                    });
                }
                if (!noText) {
                    let fontSize = Math.floor(24 / 900 * size);
                    let context = picCanvas.getContext("2d");
                    context.strokeStyle = "#808080";
                    context.lineWidth = 3;
                    context.font = fontSize.toFixed(0) + "px Roboto";
                    let lengthTitle = context.measureText(this.machine.name);
                    context.fillStyle = "white";
                    context.font = "100 " + (fontSize * 0.8).toFixed(0) + "px Roboto";
                    let numText = "n° " + this.machine.dbId.toFixed(0) + " - ";
                    let lengthNum = context.measureText(numText);
                    context.font = "100 " + (fontSize * 0.8).toFixed(0) + "px Roboto";
                    let authorText = "created by " + this.machine.author;
                    let lengthAuthor = context.measureText(authorText);
                    let data = context.getImageData(0, 0, size, size);
                    let x0 = Math.min(Math.floor(size * 0.7 - lengthTitle.width - lengthNum.width - 2 * fontSize), Math.floor(size * 0.7 - lengthAuthor.width - 1 * fontSize - 0.06 * size - fontSize));
                    let x1 = Math.floor(size * 0.7);
                    let y0 = Math.floor(0.5 * fontSize);
                    let y1 = Math.floor(4.3 * fontSize);
                    let l = x1 - x0;
                    x0 = Math.floor((size * 0.5 - l * 0.5));
                    x1 = Math.floor((size * 0.5 + l * 0.5));
                    console.log(data.data.length);
                    for (let x = x0; x < x1; x++) {
                        for (let y = y0; y < y1; y++) {
                            let n = y * size + x;
                            data.data[4 * n] = Math.floor(data.data[4 * n] * 0.6);
                            data.data[4 * n + 1] = Math.floor(data.data[4 * n + 1] * 0.6);
                            data.data[4 * n + 2] = Math.floor(data.data[4 * n + 2] * 0.6);
                        }
                    }
                    context.putImageData(data, 0, 0);
                    context.font = fontSize.toFixed(0) + "px Roboto";
                    context.fillText(this.machine.name, Math.floor(size * 0.5 + l * 0.5 - lengthTitle.width - 1 * fontSize), Math.floor(2 * fontSize));
                    context.font = "100 " + (fontSize * 0.8).toFixed(0) + "px Roboto";
                    context.fillStyle = "white";
                    context.fillText(numText, Math.floor(size * 0.5 + l * 0.5 - lengthTitle.width - lengthNum.width - 1 * fontSize), Math.floor(2 * fontSize));
                    context.font = "100 " + (fontSize * 0.8).toFixed(0) + "px Roboto";
                    context.fillStyle = "white";
                    context.fillText(authorText, Math.floor(size * 0.5 + l * 0.5 - lengthAuthor.width - 1 * fontSize - 0.06 * size), Math.floor(3.3 * fontSize));
                    let flag = document.createElement("img");
                    let country = this.machine.country;
                    if (!country) {
                        country = "xx";
                    }
                    flag.src = "styles/flags/4x3/" + this.machine.country + ".svg";
                    flag.addEventListener("load", () => {
                        let r = flag.width / flag.height;
                        context.drawImage(flag, size * 0.5 + l * 0.5 - size * 0.07, Math.floor(2.5 * fontSize), 0.04 * size, 0.04 * size / r);
                        let logo = document.createElement("img");
                        logo.src = "datas/icons-mrs/title-text-only.png";
                        logo.addEventListener("load", () => {
                            let r = logo.width / logo.height;
                            context.drawImage(logo, 0.5 * (size - size * 0.35), size - 0.35 * size / r, size * 0.35, 0.35 * size / r);
                            let pokiLogo = document.createElement("img");
                            pokiLogo.src = "datas/icons-mrs/poki.svg";
                            pokiLogo.addEventListener("load", () => {
                                let r = pokiLogo.width / pokiLogo.height;
                                context.drawImage(pokiLogo, size * 0.87, size * 0.94, 0.10 * size, 0.10 * size / r);
                                context.font = "100 " + (fontSize * 0.8).toFixed(0) + "px Roboto";
                                let pokiText = "僅限於";
                                context.fillStyle = "white";
                                context.fillText(pokiText, Math.floor(0.9 * size), Math.floor(0.93 * size));
                                var tmpLink = document.createElement('a');
                                tmpLink.download = picName + ".png";
                                tmpLink.href = picCanvas.toDataURL();
                                console.log(tmpLink.href);
                                document.body.appendChild(tmpLink);
                                tmpLink.click();
                                document.body.removeChild(tmpLink);
                                this.canvas.setAttribute("width", canvasW);
                                this.canvas.setAttribute("height", canvasH);
                                resolve();
                            });
                        });
                    });
                }
                else {
                    var tmpLink = document.createElement('a');
                    tmpLink.download = picName + ".png";
                    tmpLink.href = picCanvas.toDataURL();
                    document.body.appendChild(tmpLink);
                    tmpLink.click();
                    document.body.removeChild(tmpLink);
                    this.canvas.setAttribute("width", canvasW);
                    this.canvas.setAttribute("height", canvasH);
                    resolve();
                }
            });
        });
    }
    updateCameraLayer(useBallCamera) {
        if (this.machine && this.machine.ready) {
            let activeCamera = useBallCamera ? this.ballCamera : this.arcCamera;
            if (activeCamera) {
                if (this.horizontalBlur) {
                    this.horizontalBlur.dispose();
                }
                if (this.verticalBlur) {
                    this.verticalBlur.dispose();
                }
                if (this.camBackGround) {
                    this.camBackGround.dispose();
                }
                if (this.getGraphicQ() > 0 && this.room && this.room.isBlurred) {
                    this.camBackGround = new BABYLON.FreeCamera("background-camera", BABYLON.Vector3.Zero());
                    this.camBackGround.layerMask = 0x10000000;
                    activeCamera.layerMask = 0x0FFFFFFF;
                    this.camBackGround.parent = activeCamera;
                    this.horizontalBlur = new BABYLON.BlurPostProcess("blurH", new BABYLON.Vector2(1, 0), 16, 1, this.camBackGround);
                    this.verticalBlur = new BABYLON.BlurPostProcess("blurV", new BABYLON.Vector2(0, 1), 16, 1, this.camBackGround);
                    this.scene.activeCameras = [this.camBackGround, activeCamera];
                }
                else {
                    if (this.camBackGround) {
                        this.camBackGround.dispose();
                    }
                    activeCamera.layerMask = 0x1FFFFFFF;
                    this.scene.activeCameras = [activeCamera];
                }
            }
        }
    }
    updateShadowGenerator() {
        if (this.arcCamera) {
            if (this.getGraphicQ() >= Core.GraphicQuality.VeryHigh && !this.shadowGenerator) {
                this.shadowGenerator = new BABYLON.ShadowGenerator(2048, this.directionalLight);
                this.shadowGenerator.useBlurExponentialShadowMap = true;
                this.shadowGenerator.depthScale = 0.01;
                this.shadowGenerator.blurScale = 1;
                this.shadowGenerator.useKernelBlur = true;
                this.shadowGenerator.blurKernel = 4;
                this.shadowGenerator.setDarkness(0.8);
            }
            else {
                if (this.shadowGenerator) {
                    this.shadowGenerator.dispose();
                    delete this.shadowGenerator;
                }
            }
        }
    }
    getCameraMinFOV() {
        let ratio = this.engine.getRenderWidth() / this.engine.getRenderHeight();
        let fov = this.arcCamera.fov;
        if (ratio > 1) {
            return fov;
        }
        return fov * ratio;
    }
    getCameraHorizontalFOV() {
        return 2 * Math.atan(this.screenRatio * Math.tan(this.arcCamera.fov / 2));
    }
    getCameraZoomFactor() {
        let f = 1;
        if (this.cameraMode === CameraMode.Ball || this.cameraMode === CameraMode.Landscape) {
            f = 1 - (this.targetCamRadius - this.arcCamera.lowerRadiusLimit) / (this.arcCamera.upperRadiusLimit - this.arcCamera.lowerRadiusLimit);
        }
        else {
            f = 1 - (this.arcCamera.radius - this.arcCamera.lowerRadiusLimit) / (this.arcCamera.upperRadiusLimit - this.arcCamera.lowerRadiusLimit);
        }
        return f * f;
    }
    setCameraZoomFactor(v) {
        this.targetCamRadiusFromWheel = false;
        v = Nabu.MinMax(v, 0, 1);
        let f = Math.sqrt(v);
        if (this.cameraMode === CameraMode.Ball || this.cameraMode === CameraMode.Landscape) {
            this.targetCamRadius = (1 - f) * (this.arcCamera.upperRadiusLimit - this.arcCamera.lowerRadiusLimit) + this.arcCamera.lowerRadiusLimit;
        }
        else {
            this.animateCamera([this.arcCamera.alpha, this.arcCamera.beta, (1 - f) * (this.arcCamera.upperRadiusLimit - this.arcCamera.lowerRadiusLimit) + this.arcCamera.lowerRadiusLimit], 0.3);
        }
    }
    randomLandscapeTargetAlpha() {
        return this.targetCamAlpha = -0.3 * Math.PI - Math.random() * Math.PI * 0.6;
    }
    randomLandscapeTargetBeta() {
        return this.targetCamBeta = 0.25 * Math.PI + Math.random() * Math.PI * 0.2;
    }
    async setCameraMode(camMode, limits) {
        if ((this.cameraMode === CameraMode.FirstPersonBall || this.cameraMode === CameraMode.SideViewBall) && camMode != this.cameraMode) {
            await this.ballCamera.deactivate();
        }
        this.arcCamera.inputs.attached["pointers"]["angularSensibilityX"] = 3000;
        this.arcCamera.inputs.attached["pointers"]["angularSensibilityY"] = 3000;
        this.arcCamera.inputs.attached["keyboard"]["angularSpeed"] = 0.005;
        this.arcCamera.inputs.attached["pointers"]["panningSensibility"] = 1000;
        this.config.getElement("pan-precision").forceInit();
        this.arcCamera.lowerAlphaLimit = null;
        this.arcCamera.upperAlphaLimit = null;
        this.arcCamera.lowerBetaLimit = Math.PI / 180;
        this.arcCamera.upperBetaLimit = Math.PI * 0.55;
        if ((this.mode === GameMode.Create || this.mode === GameMode.Challenge || this.mode === GameMode.BBPuzzle) && this.machine.constructionMode === Core.MachineConstructionMode.Mode2D) {
            this.arcCamera.inputs.attached["pointers"]["angularSensibilityX"] = Infinity;
            this.arcCamera.inputs.attached["pointers"]["angularSensibilityY"] = Infinity;
            this.arcCamera.inputs.attached["keyboard"]["angularSpeed"] = 0;
            if (this.mode === GameMode.BBPuzzle) {
                this.arcCamera.inputs.attached["pointers"]["panningSensibility"] = 1000;
            }
            else {
                this.arcCamera.inputs.attached["pointers"]["panningSensibility"] = Infinity;
            }
            this.arcCamera.inputs.attached["pointers"]["useNaturalPinchZoom"] = true;
        }
        else {
            this.arcCamera.inputs.attached["pointers"]["useNaturalPinchZoom"] = false;
        }
        if (limits) {
            if (limits.lockRotation) {
                this.arcCamera.inputs.attached["pointers"]["angularSensibilityX"] = Infinity;
                this.arcCamera.inputs.attached["pointers"]["angularSensibilityY"] = Infinity;
                this.arcCamera.inputs.attached["keyboard"]["angularSpeed"] = 0;
            }
            if (limits.lockPanning) {
                this.arcCamera.inputs.attached["pointers"]["panningSensibility"] = Infinity;
            }
            if (isFinite(limits.alpha) && isFinite(limits.alphaRange)) {
                this.arcCamera.lowerAlphaLimit = limits.alpha - limits.alphaRange * 0.5;
                this.arcCamera.upperAlphaLimit = limits.alpha + limits.alphaRange * 0.5;
            }
            if (isFinite(limits.beta) && isFinite(limits.betaRange)) {
                this.arcCamera.lowerBetaLimit = limits.beta - limits.betaRange * 0.5;
                this.arcCamera.upperBetaLimit = limits.beta + limits.betaRange * 0.5;
            }
        }
        if (camMode >= CameraMode.None && camMode <= CameraMode.Landscape) {
            if (this.mode === GameMode.Create && this.machine.constructionMode === Core.MachineConstructionMode.Mode2D) {
                let baseMeshMin = new BABYLON.Vector3(this.machine.baseMeshMinX, this.machine.baseMeshMinY, this.machine.baseMeshMinZ);
                let baseMeshMax = new BABYLON.Vector3(this.machine.baseMeshMaxX, this.machine.baseMeshMaxY, this.machine.baseMeshMaxZ);
                let size = BABYLON.Vector3.Distance(baseMeshMin, baseMeshMax);
                this.targetCamTarget.x = baseMeshMin.x * 0.5 + baseMeshMax.x * 0.5;
                this.targetCamTarget.y = baseMeshMin.y * 0.5 + baseMeshMax.y * 0.5;
                this.targetCamTarget.z = 0;
                this.targetCamRadius = size * 2;
            }
            else {
                let baseMeshMin = new BABYLON.Vector3(this.machine.baseMeshMinX, this.machine.baseMeshMinY, this.machine.baseMeshMinZ);
                let baseMeshMax = new BABYLON.Vector3(this.machine.baseMeshMaxX, this.machine.baseMeshMaxY, this.machine.baseMeshMaxZ);
                let size = BABYLON.Vector3.Distance(baseMeshMin, baseMeshMax);
                this.targetCamTarget.x = baseMeshMin.x * 0.5 + baseMeshMax.x * 0.5;
                this.targetCamTarget.y = baseMeshMin.y * 0.6 + baseMeshMax.y * 0.4;
                this.targetCamTarget.z = baseMeshMin.z * 0.5 + baseMeshMax.z * 0.5;
                this.targetCamRadius = size * 1.2;
            }
            this.cameraMode = camMode;
            if (this.cameraMode == CameraMode.None) {
            }
            else {
                this.targetCamRadiusFromWheel = false;
                if (this.cameraMode === CameraMode.Ball) {
                    this.targetCamRadius = 0.3;
                }
                else {
                }
                this.targetCamAlpha = this.randomLandscapeTargetAlpha();
                this.targetCamBeta = this.randomLandscapeTargetBeta();
            }
        }
        else if (camMode === CameraMode.Selected) {
            if (this.mode === GameMode.Create) {
                this.cameraMode = camMode;
                this.targetCamAlpha = this.arcCamera.alpha;
                this.targetCamBeta = this.arcCamera.beta;
                this.targetCamRadius = this.arcCamera.radius;
                this.targetCamTarget.copyFrom(this.arcCamera.target);
            }
        }
        else if (camMode === CameraMode.Transition) {
            this.cameraMode = CameraMode.Transition;
        }
        else if (camMode === CameraMode.Movie) {
            this.cameraMode = CameraMode.Movie;
            this.movieMaker.currentIndex = 0;
        }
        else if (camMode === CameraMode.FirstPersonBall) {
            this.cameraMode = CameraMode.FirstPersonBall;
            this.ballCamera.firstPersonMode = true;
            this.ballCamera.activate();
        }
        else if (camMode === CameraMode.SideViewBall) {
            this.cameraMode = CameraMode.SideViewBall;
            this.ballCamera.firstPersonMode = false;
            this.ballCamera.activate();
        }
        if (this.topbar) {
            this.topbar.resize();
        }
    }
    getCameraRadiusToFocusMachineParts(...machineParts) {
        let start = new BABYLON.Vector3(Infinity, -Infinity, -Infinity);
        let end = new BABYLON.Vector3(-Infinity, Infinity, Infinity);
        machineParts.forEach(part => {
            if (part instanceof Core.MachinePart) {
                start.x = Math.min(start.x, part.position.x + part.encloseStart.x);
                start.y = Math.max(start.y, part.position.y + part.encloseStart.y);
                start.z = Math.max(start.z, part.position.z + part.encloseStart.z);
                end.x = Math.max(end.x, part.position.x + part.encloseEnd.x);
                end.y = Math.min(end.y, part.position.y + part.encloseEnd.y);
                end.z = Math.min(end.z, part.position.z + part.encloseEnd.z);
                if (part instanceof Core.BlackBoard) {
                    end.y += 0.035;
                }
            }
        });
        if (!Mummu.IsFinite(start) || !Mummu.IsFinite(end)) {
            return 1;
        }
        let w = (end.x - start.x);
        let distW = 0.5 * w / (Math.tan(this.getCameraHorizontalFOV() * 0.5));
        let h = (start.y - end.y);
        let distH = 0.5 * h / (Math.tan(this.arcCamera.fov * 0.5));
        if (this.screenRatio >= 1) {
            distW *= 2;
            distH *= 2;
        }
        else {
            distW *= 1.1;
            distH *= 1.1;
        }
        return Math.max(distW, distH);
    }
    async focusMachineParts(updateAlphaBetaRadius, centerOnXZero, ...machineParts) {
        let start = new BABYLON.Vector3(Infinity, Infinity, Infinity);
        let end = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
        machineParts.forEach(part => {
            if (part instanceof Core.MachinePart) {
                start.minimizeInPlace(part.position);
                end.maximizeInPlace(part.position);
                start.minimizeInPlace(part.worldAABBMin);
                end.maximizeInPlace(part.worldAABBMax);
                if (part instanceof Core.BlackBoard) {
                    start.y = Math.min(end.y, part.worldAABBMin.y - 0.035);
                    end.y = Math.max(end.y, part.worldAABBMax.y + 0.035);
                }
            }
        });
        if (!Mummu.IsFinite(start) || !Mummu.IsFinite(end)) {
            return;
        }
        if (centerOnXZero) {
            let halfW = Math.max(Math.abs(start.x), Math.abs(end.x));
            start.x = -halfW;
            end.x = halfW;
        }
        let center = start.add(end).scale(0.5);
        let w = (end.x - start.x);
        let h = (end.y - start.y);
        if (this.screenRatio > 1) {
            w += 0.2;
            h += 0.2;
        }
        else {
            w += 0.1;
            h += 0.1;
        }
        let distW = 0.5 * w / (Math.tan(this.getCameraHorizontalFOV() * 0.5));
        let distH = 0.5 * h / (Math.tan(this.arcCamera.fov * 0.5));
        if (updateAlphaBetaRadius) {
            if (this.machine.constructionMode === Core.MachineConstructionMode.Mode2D) {
                this.targetCamRadius = Math.max(distW, distH);
                this.targetCamAlpha = -0.5 * Math.PI;
                if (this.mode === GameMode.BBPuzzle) {
                    this.targetCamBeta = 0.45 * Math.PI;
                }
                else {
                    this.targetCamBeta = 0.4 * Math.PI;
                }
            }
            else {
                distW *= 1.5;
                distH *= 1.5;
                this.targetCamRadius = Math.max(distW, distH);
                this.targetCamAlpha = -0.6 * Math.PI;
                this.targetCamBeta = 0.3 * Math.PI;
            }
        }
        else {
            this.targetCamRadius = this.arcCamera.radius;
            this.targetCamAlpha = this.arcCamera.alpha;
            this.targetCamBeta = this.arcCamera.beta;
        }
        this.targetCamRadius = Nabu.MinMax(this.targetCamRadius, this.arcCamera.lowerRadiusLimit, this.arcCamera.upperRadiusLimit);
        this.targetCamTarget.copyFrom(center);
        if (this.cameraMode === CameraMode.Selected) {
            this.cameraMode = CameraMode.FocusingSelected;
        }
        else {
            this.cameraMode = CameraMode.Focusing;
        }
        this.arcCamera.detachControl();
    }
    showGraphicAutoUpdateAlert(message) {
        let alert = document.getElementById("auto-update-graphic-alert");
        if (message) {
            alert.innerText = message;
        }
        else if (this.getGraphicQ() === Core.GraphicQuality.VeryLow) {
            alert.innerText = "圖像品質設為「極低」";
        }
        else if (this.getGraphicQ() === Core.GraphicQuality.Low) {
            alert.innerText = "圖像品質設為「低」";
        }
        else if (this.getGraphicQ() === Core.GraphicQuality.Medium) {
            alert.innerText = "圖像品質設為「中」";
        }
        else if (this.getGraphicQ() === Core.GraphicQuality.High) {
            alert.innerText = "圖像品質設為「高」";
        }
        else if (this.getGraphicQ() === Core.GraphicQuality.VeryHigh) {
            alert.innerText = "圖像品質設為「極高」";
        }
        alert.style.opacity = "0";
        alert.style.display = "block";
        clearInterval(this._showGraphicAutoUpdateAlertInterval);
        let n = 0;
        this._showGraphicAutoUpdateAlertInterval = setInterval(() => {
            n++;
            if (n <= 60) {
                alert.style.opacity = (n / 60 * 100).toFixed(0) + "%";
            }
            else {
                clearInterval(this._showGraphicAutoUpdateAlertInterval);
                clearTimeout(this._hideGraphicAutoUpdateAlertTimout);
                this._hideGraphicAutoUpdateAlertTimout = setTimeout(() => {
                    let n = 60;
                    clearInterval(this._showGraphicAutoUpdateAlertInterval);
                    this._showGraphicAutoUpdateAlertInterval = setInterval(() => {
                        n--;
                        if (n > 0) {
                            alert.style.opacity = (n / 60 * 100).toFixed(0) + "%";
                        }
                        else {
                            clearInterval(this._showGraphicAutoUpdateAlertInterval);
                            alert.style.opacity = "0";
                            alert.style.display = "none";
                        }
                    }, 15);
                }, 2000);
            }
        }, 15);
    }
    updateMachineAuthorAndName() {
        if (this.machine) {
            if (isFinite(this.machine.dbId)) {
                document.querySelector("#machine-title .machine-number").innerHTML = "n° " + this.machine.dbId + " - ";
            }
            document.querySelector("#machine-name .value").innerHTML = this.machine.name;
            document.querySelector("#machine-author .value").innerHTML = this.machine.author;
        }
        this.updateMachineAuthorAndNameVisibility();
    }
    updateMachineAuthorAndNameVisibility() {
        if (this.mode <= GameMode.Page || this.mode === GameMode.BBPuzzle) {
            document.querySelector("#machine-title .machine-number").style.display = "none";
            document.querySelector("#machine-title").style.display = "none";
            document.querySelector("#machine-author").style.display = "none";
        }
        else {
            if (this.mode === GameMode.Demo) {
                document.querySelector("#machine-title .machine-number").style.display = "";
            }
            else {
                document.querySelector("#machine-title .machine-number").style.display = "none";
            }
            document.querySelector("#machine-title").style.display = "";
            if (this.machine.isChallengeMachine) {
                document.querySelector("#machine-author").style.display = "none";
            }
            else {
                document.querySelector("#machine-author").style.display = "";
            }
        }
    }
    setEditMachineName(active) {
        this.editMachineNameActive = active;
        if (active) {
            this.setEditMachineAuthor(false);
            document.querySelector("#machine-name").style.display = "none";
            document.querySelector("#machine-name-edit").style.display = "block";
            document.querySelector("#machine-name-edit").setAttribute("value", this.machine.name);
        }
        else {
            this.updateMachineAuthorAndName();
            document.querySelector("#machine-name").style.display = "block";
            document.querySelector("#machine-name-edit").style.display = "none";
        }
    }
    setEditMachineAuthor(active) {
        this.editMachineAuthorActive = active;
        if (active) {
            this.setEditMachineName(false);
            document.querySelector("#machine-author").style.display = "none";
            document.querySelector("#machine-author-edit").style.display = "inline-block";
            document.querySelector("#machine-author-edit").setAttribute("value", this.machine.author);
        }
        else {
            this.updateMachineAuthorAndName();
            document.querySelector("#machine-author").style.display = "inline-block";
            document.querySelector("#machine-author-edit").style.display = "none";
        }
    }
    get curtainOpacity() {
        return this._curtainOpacity;
    }
    set curtainOpacity(v) {
        this._curtainOpacity = v;
        if (this._curtainOpacity === 0) {
            this.canvasCurtain.style.display = "none";
        }
        else {
            this.canvasCurtain.style.display = "block";
            this.canvasCurtain.style.backgroundColor = "#000000" + Math.round(this._curtainOpacity * 255).toString(16).padStart(2, "0");
        }
    }
    async checkLiveServiceAvailability() {
        console.log("checkLiveServiceAvailability");
        const __probeController = new AbortController();
        const __probeTimeout = setTimeout(() => { __probeController.abort(); }, 6000);
        try {
            let dataResponse = await fetch(SHARE_SERVICE_PATH + "machine/" + CHECK_SERVICE_MACHINE_ID.toFixed(0), { signal: __probeController.signal });
            if (dataResponse) {
                let data = await dataResponse.json();
                if (data.id === CHECK_SERVICE_MACHINE_ID) {
                    this.setOFFLINE_MODE(false);
                }
            }
        }
        catch (e) {
            this.setOFFLINE_MODE(true);
        }
        finally {
            clearTimeout(__probeTimeout);
        }
    }
    setOFFLINE_MODE(OFFLINE_MODE) {
        this.OFFLINE_MODE = OFFLINE_MODE;
        document.querySelector("#machine-page-server-status-container").style.opacity = this.OFFLINE_MODE ? "50%" : "100%";
        document.querySelector("#machine-page-server-status-container span").innerText = this.OFFLINE_MODE ? "OFFLINE" : "LIVE";
        if (this.machineEditor && this.machineEditor.machinePartEditorMenu && this.machineEditor.machinePartEditorMenu.publishButton) {
            if (this.OFFLINE_MODE) {
                this.machineEditor.machinePartEditorMenu.publishButton.classList.add("disabled");
            }
            else {
                this.machineEditor.machinePartEditorMenu.publishButton.classList.remove("disabled");
            }
        }
    }
}
function LogTracksBarycenter() {
    let machine = Game.Instance.machine;
    let center = new BABYLON.Vector3((machine.baseMeshMinX + machine.baseMeshMaxX) * 0.5, (machine.baseMeshMinY + machine.baseMeshMaxY) * 0.5, (machine.baseMeshMinZ + machine.baseMeshMaxZ) * 0.5);
    //"x": 0.038, "y": 0.075, "z": 0.090
    console.log("x: " + center.x.toFixed(3) + ", y: " + center.y.toFixed(3) + ", z: " + center.z.toFixed(3));
}
async function GenerateOfflineDatabase() {
    let state = 1 << Core.MachineDBState.Ok | 1 << Core.MachineDBState.Star;
    let headers = {};
    if (Game.Instance.devMode.activated) {
        state = 0;
        for (let s = Core.MachineDBState.Pending; s <= Core.MachineDBState.Star; s++) {
            if (Game.Instance.devMode.filterMachines[s]) {
                state |= 1 << s;
            }
        }
        headers = {
            "Authorization": 'Basic ' + btoa("carillon:" + Game.Instance.devMode.getPassword())
        };
    }
    let sortValue = 0;
    let dateRangeValue = 0;
    let dataResponse = await fetch(SHARE_SERVICE_PATH + "get_machines/0/100000/" + state + "/" + sortValue.toFixed(0) + "/" + dateRangeValue.toFixed(0), {
        method: "GET",
        mode: "cors",
        headers: headers
    });
    let dataText = await dataResponse.text();
    Nabu.download("offline_db.json", dataText);
}
function DebugThumbnailMode() {
    Game.Instance.machine.setBaseIsVisible(false);
    if (Game.Instance.room) {
        Game.Instance.room.setGroundHeight(100);
        Game.Instance.room.skybox.isVisible = false;
    }
    Game.Instance.scene.clearColor.copyFromFloats(0, 0, 0, 0);
    Game.Instance.machine.exitShooter.setIsVisible(false);
    Game.Instance.machine.exitTrack.setIsVisible(false);
    Game.Instance.machine.exitHoleIn.isVisible = false;
    Game.Instance.machine.exitHoleOut.isVisible = false;
    Game.Instance.machine.parts.forEach(part => {
        part.sleepersMeshProp = {};
        part.doSleepersMeshUpdate();
    });
    Game.Instance.machineEditor.dispose();
    Game.Instance.mode = GameMode.Demo;
    setTimeout(() => {
        //document.getElementById("thumbnail-title1").style.left = "-94.5%";
        //document.getElementById("thumbnail-title2").style.left = "105.5%";
        //document.getElementById("thumbnail-title3").style.left = "169.5%";
        let quad = BABYLON.CreatePlane("background", { width: 5.824, height: 3.264 });
        quad.parent = Game.Instance.arcCamera;
        quad.position.copyFromFloats(0, 0, 3);
        let backgroundMat = new BABYLON.StandardMaterial("background-mat");
        backgroundMat.diffuseColor.copyFromFloats(0, 0, 0);
        backgroundMat.specularColor.copyFromFloats(0, 0, 0);
        backgroundMat.emissiveColor.copyFromFloats(0, 0, 0);
        backgroundMat.emissiveTexture = new BABYLON.Texture("./work/black_abstract.jpg");
        quad.material = backgroundMat;
        Game.Instance.arcCamera.alpha = -2.0934;
        Game.Instance.arcCamera.beta = 1.2207;
        Game.Instance.arcCamera.radius = 0.6299;
        Game.Instance.arcCamera.target.copyFromFloats(-0.0091, 0.2415, 0.0641);
        Game.Instance.toolbar.container.style.display = "none";
        Game.Instance.topbar.container.style.display = "none";
        document.querySelector("#machine-title").style.display = "none";
        Game.Instance.movieMaker.deserialize({ viewpoints: [
                -0.4036295931043276,
                0.15048540771858432,
                -0.27834867386296414,
                -0.030241456193637915,
                0.23302312083540686,
                0.08517584405544118
            ] });
        setTimeout(() => {
            document.getElementById("thumbnail-title").style.width = "50svh";
            document.getElementById("thumbnail-title").style.height = "45svh";
            document.getElementById("thumbnail-title").style.top = "25svh";
            document.getElementById("thumbnail-title").style.left = "calc((100vw - 100svh) * 0.5)";
            Game.Instance.machine.play();
            Game.Instance.movieMaker.currentIndex = 0;
            Game.Instance.cameraMode = CameraMode.Movie;
        }, 2000);
    }, 1000);
}
let createAndInit = async () => {
    try {
        window.localStorage.setItem("test-local-storage", "Test Local Storage Availability");
        window.localStorage.removeItem("test-local-storage");
        HasLocalStorage = true;
    }
    catch {
        HasLocalStorage = false;
    }
    let main = new Game("render-canvas");
    await main.createScene();
    main.initialize().then(() => {
        main.animate();
    });
};
requestAnimationFrame(() => {
    if (USE_POKI_SDK) {
        PokiSDK.init().then(() => {
            createAndInit();
        });
    }
    else {
        createAndInit();
    }
});
var KeyInput;
(function (KeyInput) {
    KeyInput[KeyInput["NULL"] = -1] = "NULL";
    KeyInput[KeyInput["EDITOR_MOVE_RIGHT"] = 0] = "EDITOR_MOVE_RIGHT";
    KeyInput[KeyInput["EDITOR_MOVE_LEFT"] = 1] = "EDITOR_MOVE_LEFT";
    KeyInput[KeyInput["EDITOR_MOVE_UP"] = 2] = "EDITOR_MOVE_UP";
    KeyInput[KeyInput["EDITOR_MOVE_DOWN"] = 3] = "EDITOR_MOVE_DOWN";
    KeyInput[KeyInput["EDITOR_MOVE_FORWARD"] = 4] = "EDITOR_MOVE_FORWARD";
    KeyInput[KeyInput["EDITOR_MOVE_BACKWARD"] = 5] = "EDITOR_MOVE_BACKWARD";
    KeyInput[KeyInput["EDITOR_ROTATE"] = 6] = "EDITOR_ROTATE";
    KeyInput[KeyInput["EDITOR_ROTATE_BACK"] = 7] = "EDITOR_ROTATE_BACK";
    KeyInput[KeyInput["EDITOR_MIRROR_X"] = 8] = "EDITOR_MIRROR_X";
    KeyInput[KeyInput["EDITOR_MIRROR_Z"] = 9] = "EDITOR_MIRROR_Z";
    KeyInput[KeyInput["EDITOR_DELETE"] = 10] = "EDITOR_DELETE";
    KeyInput[KeyInput["EDITOR_FOCUS_CAM"] = 11] = "EDITOR_FOCUS_CAM";
    KeyInput[KeyInput["EDITOR_SELECT_ALL"] = 12] = "EDITOR_SELECT_ALL";
    KeyInput[KeyInput["MOVIE_MAKER_ADD_DEL_VP"] = 13] = "MOVIE_MAKER_ADD_DEL_VP";
    KeyInput[KeyInput["MOVIE_MAKER_PREV_VP"] = 14] = "MOVIE_MAKER_PREV_VP";
    KeyInput[KeyInput["MOVIE_MAKER_NEXT_VP"] = 15] = "MOVIE_MAKER_NEXT_VP";
    KeyInput[KeyInput["BALL_BOOST"] = 16] = "BALL_BOOST";
    KeyInput[KeyInput["CTRL"] = 17] = "CTRL";
})(KeyInput || (KeyInput = {}));
class MarbleConfiguration extends Nabu.Configuration {
    constructor(configName, game) {
        super(configName, CONFIGURATION_VERSION);
        this.game = game;
        this.overrideConfigurationElementCategoryName = [
            '<i18n-text text-key="option-cat-gameplay"></i18n-text>',
            '<i18n-text text-key="option-cat-graphic"></i18n-text>',
            '<i18n-text text-key="option-cat-control"></i18n-text>',
            '<i18n-text text-key="option-cat-ui"></i18n-text>',
            '<i18n-text text-key="option-cat-dev"></i18n-text>'
        ];
    }
    _buildElementsArray() {
        Nabu.SimpleInputLabels = {
            "EDITOR_MOVE_RIGHT": "編輯器向右移動",
            "EDITOR_MOVE_LEFT": "編輯器向左移動",
            "EDITOR_MOVE_UP": "編輯器向上移動",
            "EDITOR_MOVE_DOWN": "編輯器向下移動",
            "EDITOR_MOVE_FORWARD": "編輯器向前移動",
            "EDITOR_MOVE_BACKWARD": "編輯器向後移動",
            "EDITOR_ROTATE": "編輯器旋轉",
            "EDITOR_ROTATE_BACK": "編輯器反向旋轉",
            "EDITOR_DELETE": "編輯器刪除",
            "EDITOR_FOCUS_CAM": "編輯器鏡頭對焦",
            "MOVIE_MAKER_ADD_DEL_VP": "影片：加入／刪除視角",
            "MOVIE_MAKER_PREV_VP": "影片：上一個視角",
            "MOVIE_MAKER_NEXT_VP": "影片：下一個視角",
            "BALL_BOOST": "彈珠加重",
            "CTRL_DOWN": "按住 Control",
            "EDITOR_SELECT_ALL": "編輯器全選"
        };
        this.configurationElements = [
            new Nabu.ConfigurationElement("graphicQ", Nabu.ConfigurationElementType.Enum, Core.GraphicQuality.Medium, Nabu.ConfigurationElementCategory.Graphic, {
                displayName: '<i18n-text text-key="option-graphicQ"></i18n-text>',
                min: Core.GraphicQuality.VeryLow,
                max: Core.GraphicQuality.VeryHigh,
                toString: (v) => {
                    if (v === Core.GraphicQuality.VeryLow) {
                        return "極低";
                    }
                    if (v === Core.GraphicQuality.Low) {
                        return "低";
                    }
                    if (v === Core.GraphicQuality.Medium) {
                        return "中";
                    }
                    if (v === Core.GraphicQuality.High) {
                        return "高";
                    }
                    if (v === Core.GraphicQuality.VeryHigh) {
                        return "極高";
                    }
                }
            }, async (newValue, oldValue, fromUI) => {
                this.game.updateShadowGenerator();
                if (this.game.machine) {
                    this.game.machine.graphicQ = newValue;
                    await this.game.machine.instantiate(true);
                    this.game.updateMachineAuthorAndName();
                }
                await this.game.room.setRoomIndex(this.game.room.contextualRoomIndex(this.game.room.currentRoomIndex, this.game.getGraphicQ()));
            }),
            new Nabu.ConfigurationElement("lang", Nabu.ConfigurationElementType.Enum, I18NTextLangs.English, Nabu.ConfigurationElementCategory.UI, {
                displayName: '<i18n-text text-key="option-lang"></i18n-text>',
                min: I18NTextLangs.English,
                max: I18NTextLangs.MAXIMUM - 1,
                toString: (v) => {
                    return I18NTextLangNames[v].toLocaleUpperCase();
                }
            }, (newValue) => {
                I18NText.SetCurrentLang(newValue);
                if (newValue === I18NTextLangs.French) {
                    document.getElementById("eula-page").setAttribute("file", "cgu.xhtml");
                }
                else {
                    document.getElementById("eula-page").setAttribute("file", "eula.xhtml");
                }
            }),
            new Nabu.ConfigurationElement("newBallMaterial", Nabu.ConfigurationElementType.Enum, NewBallMaterial.Steel, Nabu.ConfigurationElementCategory.Gameplay, {
                displayName: '<i18n-text text-key="option-newBallMat"></i18n-text>',
                min: NewBallMaterial.Steel,
                max: NewBallMaterial.Last,
                toString: (v) => {
                    if (v === 0) {
                        return '<i18n-text text-key="option-newBallMat-0"></i18n-text>';
                    }
                    if (v === 1) {
                        return '<i18n-text text-key="option-newBallMat-1"></i18n-text>';
                    }
                    if (v === 2) {
                        return '<i18n-text text-key="option-newBallMat-2"></i18n-text>';
                    }
                }
            }),
            new Nabu.ConfigurationElement("autoPlay", Nabu.ConfigurationElementType.Boolean, false, Nabu.ConfigurationElementCategory.Gameplay, {
                displayName: '<i18n-text text-key="option-auto-play"></i18n-text>'
            }),
            new Nabu.ConfigurationElement("zoom-precision", Nabu.ConfigurationElementType.Number, 20, Nabu.ConfigurationElementCategory.Control, {
                displayName: '<i18n-text text-key="option-zoom-precision"></i18n-text>',
                min: 10,
                max: 70,
                step: 5,
                toString: (v) => {
                    return v.toFixed(0);
                }
            }, (newValue) => {
                if (this.game.arcCamera) {
                    this.game.arcCamera.pinchPrecision = newValue * newValue;
                    this.game.arcCamera.wheelPrecision = newValue * newValue / 2;
                }
            }),
            new Nabu.ConfigurationElement("pan-precision", Nabu.ConfigurationElementType.Number, 20, Nabu.ConfigurationElementCategory.Control, {
                displayName: '<i18n-text text-key="option-pan-precision"></i18n-text>',
                min: 10,
                max: 70,
                step: 5,
                toString: (v) => {
                    return v.toFixed(0);
                }
            }, (newValue) => {
                if (this.game.arcCamera) {
                    if (!IsTouchScreen) {
                        newValue += 10;
                    }
                    if (isFinite(this.game.arcCamera.panningSensibility)) {
                        this.game.arcCamera.panningSensibility = newValue * newValue * 2;
                    }
                }
            }),
            Nabu.ConfigurationElement.SimpleInput(this.game.inputManager, "EDITOR_MOVE_RIGHT", KeyInput.EDITOR_MOVE_RIGHT, "KeyD"),
            Nabu.ConfigurationElement.SimpleInput(this.game.inputManager, "EDITOR_MOVE_LEFT", KeyInput.EDITOR_MOVE_LEFT, "KeyA"),
            Nabu.ConfigurationElement.SimpleInput(this.game.inputManager, "EDITOR_MOVE_UP", KeyInput.EDITOR_MOVE_UP, "KeyE"),
            Nabu.ConfigurationElement.SimpleInput(this.game.inputManager, "EDITOR_MOVE_DOWN", KeyInput.EDITOR_MOVE_DOWN, "KeyQ"),
            Nabu.ConfigurationElement.SimpleInput(this.game.inputManager, "EDITOR_MOVE_FORWARD", KeyInput.EDITOR_MOVE_FORWARD, "KeyW"),
            Nabu.ConfigurationElement.SimpleInput(this.game.inputManager, "EDITOR_MOVE_BACKWARD", KeyInput.EDITOR_MOVE_BACKWARD, "KeyS"),
            Nabu.ConfigurationElement.SimpleInput(this.game.inputManager, "EDITOR_ROTATE", KeyInput.EDITOR_ROTATE, "KeyR"),
            Nabu.ConfigurationElement.SimpleInput(this.game.inputManager, "EDITOR_ROTATE_BACK", KeyInput.EDITOR_ROTATE_BACK, "KeyF"),
            Nabu.ConfigurationElement.SimpleInput(this.game.inputManager, "EDITOR_DELETE", KeyInput.EDITOR_DELETE, "KeyX"),
            Nabu.ConfigurationElement.SimpleInput(this.game.inputManager, "EDITOR_FOCUS_CAM", KeyInput.EDITOR_FOCUS_CAM, "Space"),
            Nabu.ConfigurationElement.SimpleInput(this.game.inputManager, "MOVIE_MAKER_ADD_DEL_VP", KeyInput.MOVIE_MAKER_ADD_DEL_VP, "KeyV"),
            Nabu.ConfigurationElement.SimpleInput(this.game.inputManager, "MOVIE_MAKER_PREV_VP", KeyInput.MOVIE_MAKER_PREV_VP, "KeyB"),
            Nabu.ConfigurationElement.SimpleInput(this.game.inputManager, "MOVIE_MAKER_NEXT_VP", KeyInput.MOVIE_MAKER_NEXT_VP, "KeyN"),
            Nabu.ConfigurationElement.SimpleInput(this.game.inputManager, "BALL_BOOST", KeyInput.BALL_BOOST, "Space"),
            Nabu.ConfigurationElement.SimpleInput(this.game.inputManager, "CTRL_DOWN", KeyInput.CTRL, "ControlLeft"),
            Nabu.ConfigurationElement.SimpleInput(this.game.inputManager, "EDITOR_SELECT_ALL", KeyInput.EDITOR_SELECT_ALL, "KeyA")
        ];
    }
    getValue(property) {
        let configElement = this.configurationElements.find(e => { return e.property === property; });
        if (configElement) {
            return configElement.value;
        }
    }
}
class MovieViewpoint {
    constructor(pos, target) {
        this.pos = pos;
        this.target = target;
    }
}
class MovieMaker {
    constructor(game) {
        this.game = game;
        this.currentIndex = 0;
        this.viewpoints = [];
        this.newCurrentIndex = 0;
        this.newCurrentIndexTimout = 0;
    }
    initialize() {
        if (HasLocalStorage) {
            let data = localStorage.getItem("marble-run-simulator-movie-maker");
            if (data) {
                this.deserialize(JSON.parse(data));
            }
        }
        if (location.host.startsWith("127.0.0.1")) {
            this.game.inputManager.addMappedKeyDownListener(KeyInput.MOVIE_MAKER_ADD_DEL_VP, () => {
                let pos = this.game.arcCamera.position.clone();
                let target = this.game.arcCamera.target.clone();
                let existingViewpointIndex = this.viewpoints.findIndex(vp => {
                    return BABYLON.Vector3.Distance(pos, vp.pos) < 0.01 && BABYLON.Vector3.Distance(target, vp.target) < 0.01;
                });
                if (existingViewpointIndex > -1) {
                    this.viewpoints.splice(existingViewpointIndex, 1);
                    this.game.showGraphicAutoUpdateAlert("Remove MovieMaker Viewpoint. " + this.viewpoints.length + " viewpoints.");
                }
                else {
                    this.viewpoints.push(new MovieViewpoint(pos, target));
                    this.game.showGraphicAutoUpdateAlert("Add MovieMaker Viewpoint. " + this.viewpoints.length + " viewpoints.");
                }
                let data = this.serialize();
                if (HasLocalStorage) {
                    localStorage.setItem("marble-run-simulator-movie-maker", JSON.stringify(data));
                }
            });
            this.game.inputManager.addMappedKeyDownListener(KeyInput.MOVIE_MAKER_PREV_VP, () => {
                if (this.viewpoints.length > 0) {
                    this.newCurrentIndex = this.newCurrentIndex - 1;
                    if (this.newCurrentIndex < 0) {
                        this.newCurrentIndex = this.viewpoints.length - 1;
                    }
                    clearTimeout(this.newCurrentIndexTimout);
                    this.newCurrentIndexTimout = setTimeout(() => {
                        this.currentIndex = this.newCurrentIndex;
                        this.game.cameraMode = CameraMode.Movie;
                    }, 200);
                }
            });
            this.game.inputManager.addMappedKeyDownListener(KeyInput.MOVIE_MAKER_NEXT_VP, () => {
                if (this.viewpoints.length > 0) {
                    this.newCurrentIndex = this.newCurrentIndex + 1;
                    if (this.newCurrentIndex >= this.viewpoints.length) {
                        this.newCurrentIndex = 0;
                    }
                    clearTimeout(this.newCurrentIndexTimout);
                    this.newCurrentIndexTimout = setTimeout(() => {
                        this.currentIndex = this.newCurrentIndex;
                        this.game.cameraMode = CameraMode.Movie;
                    }, 200);
                }
            });
        }
    }
    serialize() {
        let data = {
            viewpoints: []
        };
        for (let i = 0; i < this.viewpoints.length; i++) {
            let vp = this.viewpoints[i];
            data.viewpoints.push(vp.pos.x, vp.pos.y, vp.pos.z, vp.target.x, vp.target.y, vp.target.z);
        }
        return data;
    }
    deserialize(data) {
        this.viewpoints = [];
        for (let i = 0; i < data.viewpoints.length / 6; i++) {
            let vp = new MovieViewpoint(new BABYLON.Vector3(data.viewpoints[6 * i], data.viewpoints[6 * i + 1], data.viewpoints[6 * i + 2]), new BABYLON.Vector3(data.viewpoints[6 * i + 3], data.viewpoints[6 * i + 4], data.viewpoints[6 * i + 5]));
            this.viewpoints.push(vp);
        }
    }
}
class OfflineDatabase {
    constructor(game) {
        this.game = game;
        this._initialized = false;
    }
    async initialize() {
        let dataResponse = await fetch("./datas/offline_db.json", {
            method: "GET",
        });
        let dataText = await dataResponse.text();
        this._data = JSON.parse(dataText);
        this._initialized = true;
    }
    async offlineGet(id) {
        if (!this._initialized) {
            await this.initialize();
        }
        return this._data.machines.find((m) => {
            return m.id === id;
        });
    }
    async offlineFetch(pagenum, machinesPerPage, sortValue) {
        if (!this._initialized) {
            await this.initialize();
        }
        if (sortValue === 1) {
            this._data.machines.sort((m1, m2) => {
                return m2.likes - m1.likes;
            });
        }
        else if (sortValue === 2) {
            this._data.machines.sort((m1, m2) => {
                return m2["creation"].localeCompare(m1["creation"]);
            });
        }
        else if (sortValue === 3) {
            this._data.machines.sort((m1, m2) => {
                return m2.content.length - m1.content.length;
            });
        }
        else if (sortValue === 5) {
            this._data.machines.sort((m1, m2) => {
                return m1.likes - m2.likes;
            });
        }
        else if (sortValue === 6) {
            this._data.machines.sort((m1, m2) => {
                return m1["creation"].localeCompare(m2["creation"]);
            });
        }
        else if (sortValue === 7) {
            this._data.machines.sort((m1, m2) => {
                return m1.content.length - m2.content.length;
            });
        }
        let filteredMachines = this._data.machines;
        let result = { machines: [], count: filteredMachines.length };
        for (let i = 0; i < machinesPerPage; i++) {
            let index = pagenum * machinesPerPage + i;
            result.machines[i] = filteredMachines[index];
        }
        return result;
    }
}
var offlineDataBase = { machines: [] };
function COUNTCOUNTRYS() {
    console.log(offlineDataBase.machines.length);
    let countrys = offlineDataBase.machines.map((machine) => machine.country);
    console.log(countrys);
    let countryCount = [];
    countrys.forEach((country) => {
        let existing = countryCount.find((c) => c.country === country);
        if (existing) {
            existing.count++;
        }
        else {
            countryCount.push({ country: country, count: 1, fullName: ExistingCountryFlags.find(c => c.code === country)?.name || "未知" });
        }
    });
    countryCount.sort((a, b) => b.count - a.count);
    console.log(countryCount);
}
class PhotoMaker {
    constructor(game) {
        this.game = game;
        this.activated = false;
        this.mode = 0; // 0 = photo, 1 = video
        this.videoRes = 720;
        this._onTakePhoto = () => {
            if (this.mode === 0) {
                if (this.game.devMode.activated) {
                    this.game.makeCircuitScreenshot(1440, false, false);
                }
                else {
                    this.game.makeCircuitScreenshot(1440, false, false);
                }
            }
            else {
                if (this.game.videoMaker.isRecording) {
                    this.game.videoMaker.stopRecording().then(() => {
                        this.game.videoMaker.saveRecording();
                    });
                }
                else {
                    this.game.videoMaker.startRecording();
                    this._startRecordTimer();
                }
            }
        };
        this._onPhotoModeClick = () => {
            if (this.game.videoMaker.isRecording) {
                this.game.videoMaker.stopRecording();
            }
            this.mode = 0;
            this._photoModeButton.classList.add("active");
            this._video720ModeButton.classList.remove("active");
            this._video1080ModeButton.classList.remove("active");
            this._photoModeButton.parentElement.style.right = "calc(50vw - 200px)";
            this.game.resizeCanvas();
        };
        this._onVideo720ModeClick = () => {
            this.mode = 1;
            this.videoRes = 720;
            this._photoModeButton.classList.remove("active");
            this._video720ModeButton.classList.add("active");
            this._video1080ModeButton.classList.remove("active");
            this._photoModeButton.parentElement.style.right = "calc(50vw - 120px)";
            this.game.resizeCanvas();
        };
        this._onVideo1080ModeClick = () => {
            this.mode = 1;
            this.videoRes = 1080;
            this._photoModeButton.classList.remove("active");
            this._video720ModeButton.classList.remove("active");
            this._video1080ModeButton.classList.add("active");
            this._photoModeButton.parentElement.style.right = "calc(50vw - 40px)";
            this.game.resizeCanvas();
        };
        this._recordTimerHandler = 0;
        this._recordTimerStartTime = 0;
        this._recordTimerUpdate = () => {
            let btn = this._video720ModeButton;
            if (this.videoRes === 1080) {
                btn = this._video1080ModeButton;
            }
            let elapsed = Date.now() - this._recordTimerStartTime;
            btn.innerHTML = "00:00:" + (elapsed / 1000).toFixed(0).padStart(2, "0");
            if (this.activated && this.mode === 1 && this.game.videoMaker.isRecording) {
                requestAnimationFrame(this._recordTimerUpdate);
            }
            else {
                btn.innerHTML = "影片 " + this.videoRes.toFixed(0) + "P";
            }
        };
        this._screenshotFrame = document.getElementById("screenshot-frame");
        this._takePhotoButton = document.getElementById("take-photo-button");
        this._photoModeButton = document.getElementById("take-photo-mode-photo");
        this._video720ModeButton = document.getElementById("take-photo-mode-video-720");
        this._video1080ModeButton = document.getElementById("take-photo-mode-video-1080");
        this._takePhotoButton.addEventListener("click", this._onTakePhoto);
        this._photoModeButton.addEventListener("click", this._onPhotoModeClick);
        this._video720ModeButton.addEventListener("click", this._onVideo720ModeClick);
        this._video1080ModeButton.addEventListener("click", this._onVideo1080ModeClick);
    }
    toggle() {
        if (this.activated) {
            this.deactivate();
        }
        else {
            this.activate();
        }
    }
    activate() {
        this.activated = true;
        this._screenshotFrame.style.display = "block";
        this.game.resizeCanvas();
    }
    deactivate() {
        if (this.activated) {
            if (this.game.videoMaker.isRecording) {
                this.game.videoMaker.stopRecording();
            }
            this.activated = false;
            this._screenshotFrame.style.display = "none";
            this.game.resizeCanvas();
        }
    }
    _startRecordTimer() {
        this._recordTimerStartTime = Date.now();
        this._recordTimerUpdate();
    }
}
class Popup extends HTMLElement {
    constructor() {
        super(...arguments);
        this._loaded = false;
        this._shown = false;
        this._duration = 0;
    }
    static get observedAttributes() {
        return [
            "duration"
        ];
    }
    get loaded() {
        return this._loaded;
    }
    get shown() {
        return this._shown;
    }
    async waitLoaded() {
        return new Promise(resolve => {
            let wait = () => {
                if (this._loaded) {
                    resolve();
                }
                else {
                    requestAnimationFrame(wait);
                }
            };
            wait();
        });
    }
    connectedCallback() {
        this.initialize();
        this._loaded = true;
    }
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "duration") {
            let value = parseFloat(newValue);
            if (isFinite(value)) {
                this._duration = value;
            }
        }
    }
    initialize() {
        this.style.opacity = "0";
        this.style.display = "none";
        this.style.position = "fixed";
    }
    async show(duration = 0.3) {
        return new Promise(resolve => {
            if (!this._shown) {
                this._shown = true;
                this.style.display = "block";
                let opacity0 = parseFloat(this.style.opacity);
                let t0 = performance.now() / 1000;
                clearInterval(this._animateOpacityInterval);
                clearTimeout(this._waitToHideAfterShowTimeout);
                this._animateOpacityInterval = setInterval(() => {
                    let t = performance.now() / 1000 - t0;
                    if (t >= duration) {
                        clearInterval(this._animateOpacityInterval);
                        this.style.opacity = "1";
                        if (this._duration > 0) {
                            this._waitToHideAfterShowTimeout = setTimeout(() => {
                                this.hide(duration).then(resolve);
                            }, this._duration * 1000);
                        }
                        else {
                            resolve();
                        }
                    }
                    else {
                        let f = t / duration;
                        this.style.opacity = ((1 - f) * opacity0 + f * 1).toFixed(3);
                    }
                }, 15);
            }
        });
    }
    async hide(duration = 0.3) {
        if (duration === 0) {
            this._shown = false;
            clearInterval(this._animateOpacityInterval);
            this.style.opacity = "0";
            this.style.display = "none";
            return;
        }
        return new Promise(resolve => {
            if (this._shown) {
                this._shown = false;
                this.style.display = "block";
                let opacity0 = parseFloat(this.style.opacity);
                let t0 = performance.now() / 1000;
                clearInterval(this._animateOpacityInterval);
                clearTimeout(this._waitToHideAfterShowTimeout);
                this._animateOpacityInterval = setInterval(() => {
                    let t = performance.now() / 1000 - t0;
                    if (t >= duration) {
                        clearInterval(this._animateOpacityInterval);
                        this.style.opacity = "0";
                        this.style.display = "none";
                        resolve();
                    }
                    else {
                        let f = t / duration;
                        this.style.opacity = ((1 - f) * opacity0).toFixed(3);
                    }
                }, 15);
            }
        });
    }
}
customElements.define("nabu-popup", Popup);
class TextHelpersManager {
    constructor(game) {
        this.game = game;
        this.checkCooldown = 2;
        this.graphicQHelperRequiredChecksCount = 5;
        this.maxFPS = 0;
        this.avgFPS = 0;
        this.graphicQHelperState = 0;
        this.minimalAutoQualityFailed = Core.GraphicQuality.VeryHigh + 1;
        this.outsideClickDelay = 2000;
        this._lastGraphicQ = Core.GraphicQuality.Medium;
        this._timer = 0;
    }
    initialize() {
        this.ballCountHelper = new TextHelper("<i18n-text text-key='ball-count-helper'></i18n-text>", this.game);
        this.ballCountHelper.contentBox.classList.add("yellow");
        this.ballCountHelper.onOkCallback = () => {
            this.game.router.showOptionsPage();
            this.ballCountHelper.ignoredCount++;
            this.ballCountHelper.hide();
        };
        this.ballCountHelper.onClickOutsideCallback = () => {
            if (performance.now() - this.ballCountHelper.lastShownTime > this.outsideClickDelay) {
                this.ballCountHelper.ignoredCount++;
                this.ballCountHelper.hide();
            }
        };
        this.graphicQHelper = new TextHelper("Hey ! It seems like Marble Run Simulator runs smoothly on your machine in the MEDIUM graphic quality setting. You can the option menu here to increase the graphic quality setting.", this.game);
        this.graphicQHelper.onOkCallback = () => {
            this.graphicQHelperState = 0;
            this.game.router.showOptionsPage();
        };
        this.graphicQHelper.onClickOutsideCallback = () => {
            if (performance.now() - this.graphicQHelper.lastShownTime > this.outsideClickDelay) {
                this.graphicQHelperState = 0;
                this.graphicQHelper.hide();
            }
        };
        this.challengeHelper = new TextHelper('<p><i18n-text text-key="challenge-helper-video"></i18n-text></p>', this.game);
        this.challengeHelper.onOkCallback = () => {
            this.game.challenge.helper.show();
            this.challengeHelperInfo.contentBox.classList.add("green");
            this.challengeHelperInfo.setTarget(document.querySelector("#challenge-topbar-help"));
            if (this.game.challenge.mode === ChallengeMode.Parkour) {
                this.challengeHelperInfo.setContent('<p><i18n-text text-key="challenge-helper-info-parkour"></i18n-text></p>');
            }
            else {
                this.challengeHelperInfo.setContent('<p><i18n-text text-key="challenge-helper-info-puzzle"></i18n-text></p>');
            }
            this.challengeHelperInfo.show();
        };
        this.challengeHelper.onClickOutsideCallback = () => {
            if (performance.now() - this.challengeHelper.lastShownTime > this.outsideClickDelay) {
                this.challengeHelper.hide();
            }
        };
        this.challengeHelperInfo = new TextHelper("Press <b>WEIGHT</b> when the ball is in the highlighted Area, good luck !", this.game);
    }
    update(rawDT) {
        if (!PlayerHasInteracted) {
            return;
        }
        this._timer += rawDT;
        let fps = 1 / rawDT;
        if (isFinite(fps)) {
            this.maxFPS *= 0.999;
            this.maxFPS = Math.max(this.maxFPS * 0.9 + fps * 0.1, this.maxFPS);
            this.avgFPS *= 0.995;
            this.avgFPS += 0.005 * fps;
        }
        // Check if BallCount helper must be displayed.
        let canBallCountCheck = false;
        if (this.game.mode === GameMode.Create) {
            if (!this.game.machine.isChallengeMachine) {
                canBallCountCheck = true;
            }
        }
        if (this.ballCountHelper.ignoredCount > 0) {
            canBallCountCheck = false;
        }
        if (this.graphicQHelper.contentBox.shown) {
            canBallCountCheck = false;
        }
        if (canBallCountCheck) {
            let currentBallCount = this.game.machine.balls.length;
            let maxBallCount = Core.MaxActiveBalls[this.game.machine.graphicQ];
            if (currentBallCount > maxBallCount) {
                this.ballCountHelper.show();
                this.ballCountHelper.setTarget(this.game.router.optionButton);
            }
        }
        if (this._timer > this.checkCooldown) {
            this._timer = 0;
            let canFPSCheck = true;
            let currentGraphicQ = this.game.config.getElement("graphicQ").value;
            if (currentGraphicQ != this._lastGraphicQ) {
                canFPSCheck = false;
                this._lastGraphicQ = currentGraphicQ;
            }
            if (!this.game.machine.instantiated) {
                canFPSCheck = false;
            }
            if (this.ballCountHelper.contentBox.shown) {
                canFPSCheck = false;
            }
            if (this.graphicQHelper.contentBox.shown) {
                canFPSCheck = false;
            }
            if (this.game.router.optionsPage.shown) {
                canFPSCheck = false;
            }
            if (this.graphicQHelper.ignoredCount > 0) {
                canFPSCheck = false;
            }
            if (this.game.mode === GameMode.Page) {
                canFPSCheck = false;
            }
            if (this.game.mode === GameMode.Home) {
                canFPSCheck = false;
            }
            if (this.game.mode === GameMode.Challenge) {
                if (this.game.challenge.mode === ChallengeMode.Parkour) {
                    if (this.game.machine.playing) {
                        canFPSCheck = false;
                    }
                }
            }
            if (canFPSCheck) {
                if (currentGraphicQ < this.minimalAutoQualityFailed - 1 && this.avgFPS > 55) {
                    this.graphicQHelperState++;
                }
                else if (currentGraphicQ > Core.GraphicQuality.VeryLow && (this.avgFPS < 24 || (this.avgFPS < 55 && this.avgFPS < 0.5 * this.maxFPS))) {
                    this.graphicQHelperState--;
                }
                else {
                    this.graphicQHelperState = 0;
                }
            }
            else {
                this.graphicQHelperState = 0;
            }
            if (this.graphicQHelperState >= this.graphicQHelperRequiredChecksCount) {
                let currentGraphicQText = this.game.config.getElement("graphicQ").prop.toString(currentGraphicQ);
                let nextGraphicQText = this.game.config.getElement("graphicQ").prop.toString(currentGraphicQ + 1);
                this.graphicQHelper.setContent(`
                    <p><i18n-text text-key="graphicQ-helper-raise-1"></i18n-text> <b>` +
                    currentGraphicQText +
                    `</b> <i18n-text text-key="graphicQ-helper-raise-2"></i18n-text></p>
                    <p><i18n-text text-key="graphicQ-helper-raise-3"></i18n-text> <b>` +
                    nextGraphicQText +
                    `</b> <i18n-text text-key="graphicQ-helper-raise-4"></i18n-text></p>`);
                this.graphicQHelper.contentBox.classList.add("green");
                this.graphicQHelper.contentBox.classList.remove("red");
                this.graphicQHelper.onOkCallback = () => {
                    this.graphicQHelperState = 0;
                    this.game.config.setValue("graphicQ", currentGraphicQ + 1, true);
                };
                this.graphicQHelper.show();
                this.graphicQHelper.setTarget(this.game.router.optionButton);
            }
            else if (this.graphicQHelperState <= -this.graphicQHelperRequiredChecksCount) {
                this.minimalAutoQualityFailed = currentGraphicQ;
                let currentGraphicQText = this.game.config.getElement("graphicQ").prop.toString(currentGraphicQ);
                let prevGraphicQText = this.game.config.getElement("graphicQ").prop.toString(currentGraphicQ - 1);
                this.graphicQHelper.setContent(`
                    <p><i18n-text text-key="graphicQ-helper-lower-1"></i18n-text> <b>` +
                    currentGraphicQText +
                    `</b> <i18n-text text-key="graphicQ-helper-lower-2"></i18n-text></p>
                    <p><i18n-text text-key="graphicQ-helper-lower-3"></i18n-text> <b>` +
                    prevGraphicQText +
                    `</b> <i18n-text text-key="graphicQ-helper-lower-4"></i18n-text></p>`);
                this.graphicQHelper.contentBox.classList.remove("green");
                this.graphicQHelper.contentBox.classList.add("red");
                this.graphicQHelper.onOkCallback = () => {
                    this.graphicQHelperState = 0;
                    this.game.config.setValue("graphicQ", currentGraphicQ - 1, true);
                };
                this.graphicQHelper.show();
                this.graphicQHelper.setTarget(this.game.router.optionButton);
            }
        }
    }
    showChallengeHelperPopup() {
        this.challengeHelper.contentBox.classList.add("green");
        this.challengeHelper.setTarget(document.querySelector("#challenge-topbar-help"));
        this.challengeHelper.show();
    }
}
var ToonSoundType;
(function (ToonSoundType) {
    ToonSoundType[ToonSoundType["Poc"] = 0] = "Poc";
    ToonSoundType[ToonSoundType["Rumble"] = 1] = "Rumble";
})(ToonSoundType || (ToonSoundType = {}));
class ToonSound extends BABYLON.Mesh {
    constructor(game) {
        super("haiku");
        this.game = game;
        this.animateVisibility = Mummu.AnimationFactory.EmptyNumberCallback;
        this._timer = 0;
        this.rotDir = 1;
        this._lastDrawnTextIndex = 0;
        this._dir = BABYLON.Vector3.Up();
        BABYLON.CreateGroundVertexData({ width: 5, height: 1 }).applyToMesh(this);
        this.renderingGroupId = 1;
        this.rotationQuaternion = BABYLON.Quaternion.Identity();
        this.isVisible = false;
        let haikuMaterial = new BABYLON.StandardMaterial("toon-sound-material");
        this.dynamicTexture = new BABYLON.DynamicTexture("toon-sound-texture", { width: 200, height: 40 });
        this.dynamicTexture.hasAlpha = true;
        haikuMaterial.diffuseTexture = this.dynamicTexture;
        haikuMaterial.emissiveTexture = this.dynamicTexture;
        haikuMaterial.emissiveColor.copyFromFloats(1, 1, 1);
        haikuMaterial.specularColor.copyFromFloats(0, 0, 0);
        haikuMaterial.useAlphaFromDiffuseTexture = true;
        this.material = haikuMaterial;
        this.animateVisibility = Mummu.AnimationFactory.CreateNumber(this, this, "visibility");
    }
    get active() {
        return this.isVisible;
    }
    get scale() {
        return this.scaling.x;
    }
    set scale(v) {
        this.scaling.copyFromFloats(v, v, v);
    }
    start(soundProps) {
        this.soundProp = soundProps;
        if (this.soundProp.text) {
            this.writeText(this.soundProp.text);
        }
        else if (this.soundProp.texts) {
            this.writeText(this.soundProp.texts[0]);
            this._lastDrawnTextIndex = 0;
        }
        this.position.copyFrom(this.soundProp.pos);
        this.rotDir = ((this.soundProp.pos.x - this.game.arcCamera.target.x) > 0) ? 1 : -1;
        this._timer = 0;
        this.scale = 0;
        this.isVisible = true;
    }
    writeText(text) {
        let context = this.dynamicTexture.getContext();
        context.clearRect(0, 0, 200, 40);
        context.font = "24px BigBottomCartoon";
        let l = context.measureText(text).width;
        let color = BABYLON.Color3.FromHexString(this.soundProp.color);
        let avg = (color.r + color.g + color.b) / 3;
        context.lineWidth = 4;
        context.strokeStyle = "black";
        context.strokeText(text, 100 - l * 0.5, 34);
        context.fillStyle = this.soundProp.color;
        context.fillText(text, 100 - l * 0.5, 34);
        this.dynamicTexture.update();
    }
    update(dt) {
        this._timer += dt;
        if (this._timer >= this.soundProp.duration) {
            this.isVisible = false;
        }
        else {
            if (this.soundProp.texts) {
                let textIndex = Math.floor(this._timer / this.soundProp.duration * this.soundProp.texts.length);
                if (textIndex != this._lastDrawnTextIndex) {
                    this.writeText(this.soundProp.texts[textIndex]);
                    this._lastDrawnTextIndex = textIndex;
                }
            }
            if (this.soundProp.type === ToonSoundType.Poc) {
                let fScale = 4 * this._timer / this.soundProp.duration;
                fScale = Nabu.MinMax(fScale, 0, 1);
                this.scale = fScale * this.soundProp.size;
                let fPos = 2 * this._timer / this.soundProp.duration;
                fPos = Nabu.MinMax(fPos, 0, 1);
                fPos = Nabu.Easing.easeOutSine(fPos);
                this.position.copyFrom(this.soundProp.pos);
                this.position.x += fPos * this.rotDir * this.soundProp.size * 0.5;
                this.position.y += fPos * this.soundProp.size * 0.5;
                this._dir.copyFrom(this.game.arcCamera.globalPosition).subtractInPlace(this.position);
                Mummu.QuaternionFromYZAxisToRef(this._dir, BABYLON.Axis.Y.add(BABYLON.Axis.X.scale(0.1 * fPos * this.rotDir)), this.rotationQuaternion);
                this.visibility = 1;
            }
            else if (this.soundProp.type === ToonSoundType.Rumble) {
                this._dir.copyFrom(this.game.arcCamera.globalPosition).subtractInPlace(this.position);
                Mummu.QuaternionFromYZAxisToRef(this._dir, BABYLON.Axis.Z.add(BABYLON.Axis.X.scale(0.1 * Math.sin(4 * 2 * Math.PI * this._timer))), this.rotationQuaternion);
                let f = 4 * this._timer / this.soundProp.duration;
                f = Nabu.MinMax(f, 0, 1);
                f = Nabu.Easing.easeOutCubic(f);
                this.scale = f * this.soundProp.size;
                this.position.copyFrom(this.soundProp.pos);
                this.position.y += f * 0.5 + 0.05 * Math.sin(6 * 2 * Math.PI * this._timer);
                this.visibility = 1;
            }
        }
    }
}
class ToonSoundManager {
    constructor(game) {
        this.game = game;
        this.sounds = [];
        this.sounds = [];
        for (let i = 0; i < 10; i++) {
            this.sounds[i] = new ToonSound(this.game);
        }
    }
    start(soundProps) {
        for (let i = 0; i < 10; i++) {
            if (!this.sounds[i].active) {
                this.sounds[i].start(soundProps);
                return;
            }
        }
    }
    update(dt) {
        for (let i = 0; i < 10; i++) {
            if (this.sounds[i].active) {
                this.sounds[i].update(dt);
            }
        }
    }
}
class VideoMaker {
    constructor(canvas, _options) {
        this.canvas = canvas;
        this._options = _options;
        this.isRecording = false;
        this.videoBlob = null;
        this._mediaRecorder = null;
        this._recordedChunks = [];
        this._stream = null;
        this._audioDestination = null;
        this._mediaElementSources = [];
        this._resolveStop = null;
        this._rejectStop = null;
        this._stopPromise = null;
        this._options = this._options || {};
    }
    startRecording() {
        if (this.isRecording) {
            throw new Error("VideoMaker is already recording.");
        }
        let captureStream = this.canvas.captureStream || this.canvas.mozCaptureStream || this.canvas.webkitCaptureStream;
        if (!captureStream) {
            throw new Error("Canvas captureStream is not supported by this browser.");
        }
        this._recordedChunks = [];
        this._stream = captureStream.call(this.canvas, this._options?.frameRate || 30);
        if (this._options.captureAudio !== false) {
            this._attachAudioTracks();
        }
        let mimeType = this._determineMimeType();
        let recorderOptions = {};
        if (mimeType) {
            recorderOptions.mimeType = mimeType;
        }
        if (this._options?.videoBitsPerSecond) {
            recorderOptions.videoBitsPerSecond = this._options.videoBitsPerSecond;
        }
        let MediaRecorderCtor = window.MediaRecorder;
        if (!MediaRecorderCtor) {
            throw new Error("MediaRecorder is not supported by this browser.");
        }
        this._mediaRecorder = new MediaRecorderCtor(this._stream, recorderOptions);
        this._mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                this._recordedChunks.push(event.data);
            }
        };
        this._mediaRecorder.onerror = (event) => {
            if (this._rejectStop) {
                this._rejectStop(event.error || new Error("MediaRecorder error."));
            }
        };
        this._mediaRecorder.start();
        this.isRecording = true;
        this.videoBlob = null;
        this._stopPromise = null;
        this._resolveStop = null;
        this._rejectStop = null;
    }
    stopRecording(fileName) {
        if (!this.isRecording || !this._mediaRecorder) {
            return Promise.reject(new Error("VideoMaker is not recording."));
        }
        if (this._stopPromise) {
            return this._stopPromise;
        }
        this._stopPromise = new Promise((resolve, reject) => {
            this._resolveStop = resolve;
            this._rejectStop = reject;
            this._mediaRecorder.onstop = () => {
                let blob = new Blob(this._recordedChunks, { type: this._mediaRecorder?.mimeType || "video/mp4" });
                this.videoBlob = blob;
                this.isRecording = false;
                this._cleanupStream();
                resolve(blob);
                this._warnIfPotentiallyIncompatibleForX(blob);
                let autoFileName = fileName || (this._options?.autoDownloadOnStop ? this._resolveDefaultFileName(blob) : undefined);
                if (autoFileName) {
                    this.saveRecording(autoFileName, blob);
                }
            };
            try {
                this._mediaRecorder.stop();
            }
            catch (error) {
                reject(error);
            }
        });
        return this._stopPromise;
    }
    saveRecording(fileName, blob) {
        let video = blob || this.videoBlob;
        if (!video) {
            throw new Error("No recording available to save.");
        }
        fileName = fileName || this._resolveDefaultFileName(video);
        let url = URL.createObjectURL(video);
        let link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    _attachAudioTracks() {
        let audioEngine = this._options?.getAudioEngine ? this._options.getAudioEngine() : undefined;
        let audioContext = audioEngine?.audioContext;
        if (!audioContext || typeof audioContext.createMediaStreamDestination !== "function") {
            return;
        }
        this._audioDestination = audioContext.createMediaStreamDestination();
        if (audioEngine?.masterGain) {
            audioEngine.masterGain.connect(this._audioDestination);
        }
        let audioElements = this._options?.getAudioElements ? this._options.getAudioElements() : [];
        for (let i = 0; i < audioElements.length; i++) {
            let source = this._getOrCreateMediaElementSource(audioContext, audioElements[i]);
            if (source) {
                source.connect(this._audioDestination);
            }
        }
        this._audioDestination.stream.getAudioTracks().forEach(track => {
            this._stream?.addTrack(track);
        });
    }
    _getOrCreateMediaElementSource(audioContext, element) {
        let existingSource = this._mediaElementSources.find(entry => {
            return entry.element === element;
        });
        if (existingSource) {
            return existingSource.source;
        }
        try {
            let source = audioContext.createMediaElementSource(element);
            source.connect(audioContext.destination);
            this._mediaElementSources.push({ element, source });
            return source;
        }
        catch (error) {
            console.warn("VideoMaker: unable to capture audio element.", element, error);
            return null;
        }
    }
    _cleanupAudioCapture() {
        if (!this._audioDestination) {
            return;
        }
        let audioDestination = this._audioDestination;
        let audioEngine = this._options?.getAudioEngine ? this._options.getAudioEngine() : undefined;
        if (audioEngine?.masterGain) {
            try {
                audioEngine.masterGain.disconnect(audioDestination);
            }
            catch (error) {
            }
        }
        for (let i = 0; i < this._mediaElementSources.length; i++) {
            try {
                this._mediaElementSources[i].source.disconnect(audioDestination);
            }
            catch (error) {
            }
        }
        audioDestination.stream.getTracks().forEach(track => {
            track.stop();
        });
        this._audioDestination = null;
    }
    _cleanupStream() {
        this._cleanupAudioCapture();
        if (this._stream) {
            this._stream.getTracks().forEach(track => track.stop());
            this._stream = null;
        }
        this._mediaRecorder = null;
        this._resolveStop = null;
        this._rejectStop = null;
        this._stopPromise = null;
    }
    _determineMimeType() {
        let requestedMime = this._options?.mimeType;
        let MediaRecorderCtor = window.MediaRecorder;
        if (requestedMime && MediaRecorderCtor && typeof MediaRecorderCtor.isTypeSupported === "function" && MediaRecorderCtor.isTypeSupported(requestedMime)) {
            return requestedMime;
        }
        let candidates = [
            // Prefer X-friendly MP4 combinations first when available.
            "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
            "video/mp4;codecs=h264,aac",
            "video/mp4",
            "video/webm;codecs=vp9",
            "video/webm;codecs=vp8",
            "video/webm"
        ];
        for (let type of candidates) {
            if (MediaRecorderCtor && typeof MediaRecorderCtor.isTypeSupported === "function" && MediaRecorderCtor.isTypeSupported(type)) {
                return type;
            }
        }
        return undefined;
    }
    _resolveDefaultFileName(blob) {
        let configuredName = this._options?.downloadFileName;
        let extension = this._extensionFromMimeType(blob.type);
        if (!configuredName) {
            return "canvas-recording." + extension;
        }
        let dotIndex = configuredName.lastIndexOf(".");
        if (dotIndex <= 0) {
            return configuredName + "." + extension;
        }
        return configuredName.substring(0, dotIndex + 1) + extension;
    }
    _extensionFromMimeType(mimeType) {
        let normalizedMime = (mimeType || "").toLowerCase();
        if (normalizedMime.indexOf("video/webm") === 0) {
            return "webm";
        }
        if (normalizedMime.indexOf("video/mp4") === 0) {
            return "mp4";
        }
        return "mp4";
    }
    _warnIfPotentiallyIncompatibleForX(blob) {
        let type = (blob.type || "").toLowerCase();
        if (type.indexOf("video/webm") === 0) {
            console.warn("VideoMaker: Recorded video uses WebM, which may use Opus audio and can be rejected by X. For reliable uploads, transcode to MP4 (H.264 + AAC).");
        }
    }
}
class BBPuzzleAnimator {
    static async AnimateShowElement(e) {
    }
    static async AnimateShow(machine) {
        return;
        for (let i = 0; i < machine.parts.length; i++) {
            machine.parts[i].hidePopInstante();
        }
        let sortedParts = [...machine.parts].sort((p1, p2) => {
            return BABYLON.Vector3.DistanceSquared(p2.localAABBMin, p2.localAABBMax) - BABYLON.Vector3.DistanceSquared(p1.localAABBMin, p1.localAABBMax);
        });
        for (let i = 0; i < sortedParts.length; i++) {
            await sortedParts[i].showPop(0.1);
        }
    }
    static async PopStar(star, duration) {
        return new Promise(resolve => {
            let t0 = performance.now() / 1000;
            let step = () => {
                let t = performance.now() / 1000;
                if (t - t0 < duration) {
                    let f = (t - t0) / duration;
                    f = Nabu.Easing.easeOutElastic(f);
                    let s = 0.3 + f * 0.7;
                    star.style.transform = "scale(" + s.toFixed(2) + ")";
                    requestAnimationFrame(step);
                }
                else {
                    star.style.transform = "scale(1)";
                    resolve();
                }
            };
            step();
        });
    }
    static async DepopStar(star, duration) {
        return new Promise(resolve => {
            let t0 = performance.now() / 1000;
            let step = () => {
                let t = performance.now() / 1000;
                if (t - t0 < duration) {
                    let f = (t - t0) / duration;
                    f = Nabu.Easing.easeOutCubic(f);
                    let s = 0.3 + f * 0.7;
                    star.style.transform = "scale(" + s.toFixed(2) + ")";
                    star.style.filter = "saturate(0)";
                    star.style.opacity = "0.5";
                    requestAnimationFrame(step);
                }
                else {
                    star.style.transform = "scale(1)";
                    star.style.filter = "saturate(0)";
                    star.style.opacity = "0.5";
                    resolve();
                }
            };
            step();
        });
    }
}
/*

<div id="bb-puzzle-material" class="m-stars-count-1">
    <div class="material-zone-cursor"></div>
    <div class="material-zone zone-0"></div>
    <div class="material-zone zone-1"></div>
    <div class="material-zone zone-2"></div>
    <div class="material-zone zone-3"></div>
    <div class="material-zone-zero">0 cm</div>
    <div class="material-zone-max">90 cm</div>
</div>

*/
class BBPuzzleMaterialCounter {
    constructor(bbPuzzle) {
        this.bbPuzzle = bbPuzzle;
        this.mStarsCount = 3;
        this.zones = [];
        this.container = document.querySelector("#bb-puzzle-material");
        for (let i = 0; i < 4; i++) {
            this.zones[i] = this.container.querySelector(".zone-" + i.toFixed(0));
        }
        this.zoneZero = this.container.querySelector(".material-zone-zero");
        this.zoneMax = this.container.querySelector(".material-zone-max");
        this.cursor = this.container.querySelector(".material-zone-cursor");
    }
    initialize() {
        this.container.classList.remove("m-stars-count-1", "m-stars-count-2", "m-stars-count-3");
        let mStarsCount = 3 - this.bbPuzzle.stars.length;
        this.container.classList.add("m-stars-count-" + mStarsCount.toFixed(0));
        this.zoneMax.innerHTML = (this.bbPuzzle.targetMaterial * 2.5).toFixed(0);
        this.update();
    }
    update() {
        let f = this.bbPuzzle.getUsedMaterial() / (this.bbPuzzle.targetMaterial * 2.5);
        f = Nabu.MinMax(f, 0, 1);
        if (f < 1 / 100) {
            this.cursor.style.display = "none";
        }
        else {
            this.cursor.style.display = "";
        }
        this.cursor.style.height = (f * 100).toFixed(0) + "%";
        let colorF = (f - 0.4) / 0.6;
        colorF = Nabu.MinMax(colorF, 0, 1);
        let color = new BABYLON.Color3(colorF, 1 - colorF, 0);
        this.cursor.style.backgroundColor = color.toHexString();
        let materialStarsCount = this.bbPuzzle.getMaterialStarsCount(this.bbPuzzle.getUsedMaterial());
        let remainingStarZones = 1 + materialStarsCount;
        for (let i = 0; i < remainingStarZones; i++) {
            this.zones[i].classList.remove("inactive");
        }
        for (let i = remainingStarZones; i < 4; i++) {
            this.zones[i].classList.add("inactive");
        }
    }
}
class BBPuzzlePerformanceManager {
    constructor(game) {
        this.game = game;
        this.checkCooldown = 1;
        this.graphicQHelperRequiredChecksCount = 3;
        this.avgFPS = 0;
        this.graphicQHelperState = 0;
        this.minimalAutoQualityFailed = Core.GraphicQuality.High + 1;
        this._timer = 0;
    }
    initialize() {
    }
    update(rawDT) {
        if (!PlayerHasInteracted) {
            return;
        }
        this._timer += rawDT;
        let fps = 1 / rawDT;
        if (isFinite(fps)) {
            this.avgFPS *= 0.9;
            this.avgFPS += 0.1 * fps;
        }
        if (this._timer > this.checkCooldown) {
            this._timer = 0;
            let currentGraphicQ = this.game.config.getElement("graphicQ").value;
            if (currentGraphicQ < this.minimalAutoQualityFailed - 1 && this.avgFPS > 55) {
                this.graphicQHelperState++;
            }
            else if (currentGraphicQ > Core.GraphicQuality.VeryLow && (this.avgFPS < 30)) {
                this.graphicQHelperState--;
            }
            else {
                this.graphicQHelperState = 0;
            }
            this.graphicQHelperState = Nabu.MinMax(this.graphicQHelperState, -(this.graphicQHelperRequiredChecksCount + 1), this.graphicQHelperRequiredChecksCount + 1);
            if (this.graphicQHelperState >= this.graphicQHelperRequiredChecksCount) {
                this.graphicQHelperState = 0;
                console.log("Increase GraphicQ to " + (currentGraphicQ + 1).toFixed(0));
                this.game.config.setValue("graphicQ", currentGraphicQ + 1, true);
            }
            else if (this.graphicQHelperState <= -this.graphicQHelperRequiredChecksCount) {
                this.graphicQHelperState = 0;
                this.minimalAutoQualityFailed = currentGraphicQ;
                console.log("Decrease GraphicQ to " + (currentGraphicQ - 1).toFixed(0));
                this.game.config.setValue("graphicQ", currentGraphicQ - 1, true);
            }
        }
    }
}
var BB_PUZZLE_PETS = [
    "animal-beaver",
    "animal-bee",
    "animal-bunny",
    "animal-cat",
    "animal-caterpillar",
    "animal-chick",
    "animal-cow",
    "animal-crab",
    "animal-deer",
    "animal-dog",
    "animal-elephant",
    "animal-fish",
    "animal-fox",
    "animal-giraffe",
    "animal-hog",
    "animal-koala",
    "animal-lion",
    "animal-monkey",
    "animal-panda",
    "animal-parrot",
    "animal-penguin",
    "animal-pig",
    "animal-polar",
    "animal-tiger",
];
var BB_PUZZLE_PETS_GIFTS = [
    "animal-fish",
    "animal-koala",
    "animal-caterpillar",
    "animal-cat",
    "animal-monkey",
    "animal-parrot",
    "animal-pig",
    "animal-panda",
    "animal-lion",
];
var BB_PET_NAMES = {
    "beaver": "河狸", "bee": "蜜蜂", "bunny": "兔子", "cat": "貓",
    "caterpillar": "毛毛蟲", "chick": "小雞", "cow": "牛", "crab": "螃蟹",
    "deer": "鹿", "dog": "狗", "elephant": "大象", "fish": "魚",
    "fox": "狐狸", "giraffe": "長頸鹿", "hog": "野豬", "koala": "無尾熊",
    "lion": "獅子", "monkey": "猴子", "panda": "熊貓", "parrot": "鸚鵡",
    "penguin": "企鵝", "pig": "豬", "polar": "北極熊", "tiger": "老虎"
};
class BBPuzzlePet extends BABYLON.Mesh {
    constructor(bbPuzzlePets, petName) {
        super(petName);
        this.bbPuzzlePets = bbPuzzlePets;
        this.petName = petName;
        this.positionAnim = Mummu.AnimationFactory.EmptyVector3Callback;
        this.rotationAnim = Mummu.AnimationFactory.EmptyVector3Callback;
        this._moving = false;
        let base = Mummu.CreateBeveledCylinder("base", {
            radius: Core.tileSize * 0.5,
            height: 0.005,
            tessellation: 16
        });
        base.material = this.bbPuzzlePets.bbPuzzle.game.materials.plasticBlack;
        base.parent = this;
        base.position.y = 0.0025;
        Core.MainMaterials.SetAsOutlinedMesh(base);
        this.hitBox = BABYLON.MeshBuilder.CreateBox(this.name + "-hitbox", {
            width: Core.tileSize * 1,
            height: Core.tileSize * 1,
            depth: Core.tileSize * 1
        });
        this.hitBox.position.y = 0.9 * Core.tileSize;
        this.hitBox.isVisible = false;
        this.hitBox.parent = this;
        this.positionAnim = Mummu.AnimationFactory.CreateVector3(this, this, "position");
        this.rotationAnim = Mummu.AnimationFactory.CreateVector3(this, this, "rotation");
    }
    async initialize() {
        let petMeshParts = await BABYLON.SceneLoader.ImportMeshAsync("", "datas/meshes-bb/" + this.petName + ".obj");
        petMeshParts.meshes.forEach(mesh => {
            mesh.isVisible = false;
            requestAnimationFrame(() => {
                mesh.isVisible = true;
            });
            mesh.parent = this;
            mesh.position.y = 0.006;
            if (mesh instanceof BABYLON.Mesh) {
                let vData = BABYLON.VertexData.ExtractFromMesh(mesh);
                Mummu.ScaleVertexDataInPlace(vData, 0.02);
                vData.applyToMesh(mesh);
                Core.MainMaterials.SetAsOutlinedMesh(mesh);
                mesh.material = this.bbPuzzlePets.petMaterial;
            }
        });
    }
    randomMove() {
        let moves = [this.jump, this.jump2, this.lookAround, this.vrille];
        let move = moves[Math.floor(Math.random() * moves.length)];
        move.call(this);
    }
    async jump() {
        if (this._moving) {
            return;
        }
        this._moving = true;
        let p0 = this.position.clone();
        let r0 = this.rotation.clone();
        await this.positionAnim(p0.add(new BABYLON.Vector3(0, -0.005, 0)), 0.3, Nabu.Easing.easeOutSquare);
        this.rotationAnim(r0.add(new BABYLON.Vector3(0, 2 * Math.PI, 0)), 0.6, Nabu.Easing.easeInOutSine);
        await this.positionAnim(p0.add(new BABYLON.Vector3(0, 0.03, 0)), 0.3, Nabu.Easing.easeOutSquare);
        await this.positionAnim(p0, 0.3, Nabu.Easing.easeInSquare);
        this._moving = false;
    }
    async jump2() {
        if (this._moving) {
            return;
        }
        this._moving = true;
        let p0 = this.position.clone();
        let r0 = this.rotation.clone();
        this.rotationAnim(r0.add(new BABYLON.Vector3(Math.PI * 0.25, 0, 0)), 0.4, Nabu.Easing.easeInOutSine);
        await this.positionAnim(p0.add(new BABYLON.Vector3(0, -0.005, 0)), 0.4, Nabu.Easing.easeOutSquare);
        this.rotationAnim(r0, 0.1, Nabu.Easing.easeInOutSine);
        await this.positionAnim(p0.add(new BABYLON.Vector3(0, 0.05, 0)), 0.2, Nabu.Easing.easeOutSquare);
        await this.positionAnim(p0, 0.2, Nabu.Easing.easeInSquare);
        this._moving = false;
    }
    async lookAround() {
        if (this._moving) {
            return;
        }
        this._moving = true;
        let p0 = this.position.clone();
        let r0 = this.rotation.clone();
        let wait = Mummu.AnimationFactory.CreateWait(this);
        await this.rotationAnim(r0.add(new BABYLON.Vector3(-Math.PI * 0.1, Math.PI * 0.5, 0)), 0.4, Nabu.Easing.easeInCubic);
        await wait(0.3);
        await this.rotationAnim(r0, 0.3, Nabu.Easing.easeInOutSine);
        await this.rotationAnim(r0.add(new BABYLON.Vector3(Math.PI * 0.1, -Math.PI * 0.5, 0)), 0.4, Nabu.Easing.easeInCubic);
        await wait(0.3);
        await this.rotationAnim(r0, 0.3, Nabu.Easing.easeInOutSine);
        this._moving = false;
    }
    async vrille() {
        if (this._moving) {
            return;
        }
        this._moving = true;
        let p0 = this.position.clone();
        let r0 = this.rotation.clone();
        let wait = Mummu.AnimationFactory.CreateWait(this);
        this.positionAnim(p0.add(new BABYLON.Vector3(0, 0.005, 0)), 0.4, Nabu.Easing.easeOutSquare);
        await this.rotationAnim(r0.add(new BABYLON.Vector3(0, 0, Math.PI * 0.2)), 0.4, Nabu.Easing.easeOutSquare);
        await wait(0.2);
        this.positionAnim(p0, 0.6, Nabu.Easing.easeInSquare);
        await this.rotationAnim(r0.add(new BABYLON.Vector3(0, 6 * Math.PI, 0)), 0.6, Nabu.Easing.easeInOutSine);
        this._moving = false;
    }
}
class BBPuzzlePets extends BABYLON.Mesh {
    constructor(bbPuzzle) {
        super("bb-puzzle-pets");
        this.bbPuzzle = bbPuzzle;
        this.pets = [];
        this.petMaterial = new BABYLON.StandardMaterial("petMaterial", this.bbPuzzle.game.scene);
        this.petMaterial.diffuseTexture = new BABYLON.Texture("datas/meshes-bb/Textures/colormap.png");
        this.petMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        this.petMaterial.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    }
    async initialize() {
        this.clear();
        let blackboard = this.bbPuzzle.blackboard;
        if (!blackboard) {
            return;
        }
        this.position.x = (blackboard.worldAABBMin.x + blackboard.worldAABBMax.x) * 0.5;
        this.position.y = blackboard.worldAABBMax.y + 3 * Core.BlackBoard.BoardThickness;
        for (let n = 0; n < 9; n++) {
            let petAnimalIndex = n;
            if (this.bbPuzzle.progressPanel.isPetUnlocked(BB_PUZZLE_PETS_GIFTS[petAnimalIndex])) {
                let petMesh = new BBPuzzlePet(this, BB_PUZZLE_PETS_GIFTS[petAnimalIndex]);
                petMesh.initialize();
                let nx = n % 5;
                let nz = Math.floor(n / 5);
                petMesh.position.x = (nx - 2 + nz * 0.5) * Core.tileSize * 1.6;
                petMesh.position.y = 0.001 + nz * Core.tileSize;
                petMesh.position.z = -Core.tileSize * 0.6 + nz * Core.tileSize * 1.2;
                petMesh.rotation.y = Math.PI;
                petMesh.parent = this;
                this.pets.push(petMesh);
            }
        }
        let backBase = Mummu.CreateBeveledBox("back", {
            width: Core.tileSize * 1.6 * 4,
            height: Core.tileSize,
            depth: Core.tileSize
        });
        backBase.parent = this;
        backBase.position.y = 0.5 * Core.tileSize;
        backBase.position.z = 0.6 * Core.tileSize;
        backBase.material = this.bbPuzzle.game.materials.plasticWhite;
        Core.MainMaterials.SetAsOutlinedMesh(backBase);
        this.pets.push(backBase);
    }
    clear() {
        this.pets.forEach(pet => pet.dispose());
        this.pets = [];
    }
}
/*

<div id="bb-puzzle-material" class="m-stars-count-1">
    <div class="material-zone-cursor"></div>
    <div class="material-zone zone-0"></div>
    <div class="material-zone zone-1"></div>
    <div class="material-zone zone-2"></div>
    <div class="material-zone zone-3"></div>
    <div class="material-zone-zero">0 cm</div>
    <div class="material-zone-max">90 cm</div>
</div>

*/
class BBPuzzleProgress {
    constructor(bbPuzzle) {
        this.bbPuzzle = bbPuzzle;
        this.starElements = [];
        this.totalCollectedStars = 0;
        this.currentStarsOffset = 0;
        this.currentMaxStars = 20;
        this.starsPerLine = 15;
        this.currentThresholdIndex = 0;
        this.thresholds = [
            10,
            30,
            60,
            Infinity
        ];
        this.thresholdsRewards = [
            "animal-cat",
            "animal-panda",
            "#bb-puzzle-bonus-1",
            "animal-caterpillar",
            "animal-monkey",
            "#bb-puzzle-bonus-2",
            "animal-koala",
            "animal-fish",
            "bouncermode",
            "animal-lion",
            "animal-pig",
            "animal-parrot",
        ];
        this.thresholds = [
            3,
            9,
            15,
            20,
            25,
            30,
            40,
            50,
            60,
            80,
            100,
            120,
            Infinity
        ];
        this.container = document.querySelector("#bb-puzzle-progress");
        this.titleElement = this.container.querySelector(".title");
        this.rewardElement = this.container.querySelector(".unlocked-reward");
        this.textElement = this.container.querySelector(".text");
        this.starsContainer = this.container.querySelector(".stars-container");
    }
    isBonusLevelUnlocked(level) {
        if (this.currentThresholdIndex > this.thresholdsRewards.indexOf("#bb-puzzle-bonus-" + level.toFixed(0))) {
            return true;
        }
        return false;
    }
    getBonusLevelCost(level) {
        return this.thresholds[this.thresholdsRewards.indexOf("#bb-puzzle-bonus-" + level.toFixed(0))] || Infinity;
    }
    isPetUnlocked(pet) {
        if (this.currentThresholdIndex > this.thresholdsRewards.indexOf(pet)) {
            return true;
        }
        return false;
    }
    get bouncerModeUnlocked() {
        return this.currentThresholdIndex > this.thresholdsRewards.indexOf("bouncermode");
    }
    getBouncerModeCost() {
        return this.thresholds[this.thresholdsRewards.indexOf("bouncermode")] || Infinity;
    }
    initialize() {
        this.rewardElement.style.display = "none";
        this.totalCollectedStars = this.bbPuzzle.game.bbPuzzleLoader.getTotalStarsCount();
        this.currentThresholdIndex = this.totalStarsToThresholdIndex(this.totalCollectedStars);
        if (this.currentThresholdIndex === 0) {
            this.currentStarsOffset = 0;
        }
        else {
            this.currentStarsOffset = this.thresholds[this.currentThresholdIndex - 1];
        }
        this.currentMaxStars = this.thresholds[this.currentThresholdIndex] - this.currentStarsOffset;
        if (!isFinite(this.currentMaxStars)) {
            this.currentMaxStars = 30;
        }
        this.currentMaxStars = Math.min(this.currentMaxStars, 30);
        this.titleElement.innerHTML = "進度 - " + this.totalCollectedStars.toFixed(0) + " / " + this.thresholds[this.currentThresholdIndex].toFixed(0);
        this.textElement.innerHTML = "收集 " + this.thresholds[this.currentThresholdIndex].toFixed(0) + " 顆星星解鎖隱藏關卡！";
        this.textElement.classList.remove("inline");
        this.starElements = [];
        this.starsContainer.style.display = "inline-block";
        this.starsContainer.innerHTML = "";
        //let currentStarLine = document.createElement("div");
        //this.starsContainer.appendChild(currentStarLine);
        for (let i = 0; i < this.currentMaxStars; i++) {
            let starElement = document.createElement("img");
            starElement.src = "./datas/icons-bb/star.png";
            this.starElements[i] = starElement;
            starElement.classList.add("star");
            if (i >= this.totalCollectedStars - this.currentStarsOffset) {
                starElement.classList.add("inactive");
            }
            //if (currentStarLine.childElementCount >= this.starsPerLine) {
            //    currentStarLine = document.createElement("div");
            //    this.starsContainer.appendChild(currentStarLine);
            //}
            this.starsContainer.appendChild(starElement);
        }
    }
    showReward(index) {
        this.rewardElement.style.display = "inline-block";
        let rewardHref = this.thresholdsRewards[index];
        if (rewardHref) {
            if (rewardHref.startsWith("#bb-puzzle")) {
                this.rewardElement.onclick = () => {
                    window.location.href = rewardHref;
                };
            }
            else if (rewardHref === "bouncermode") {
                this.bbPuzzle.game.router.bbPuzzlesMenu.setGameMode(1);
                this.bbPuzzle.game.router.bbPuzzlesMenu.redraw();
                this.rewardElement.onclick = () => {
                    window.location.href = "#bb-puzzles";
                };
            }
        }
        this.starsContainer.style.display = "none";
        this.titleElement.innerHTML = "恭喜！";
        this.textElement.innerHTML = "解鎖獎勵關卡 :)";
        this.rewardElement.innerHTML = "玩獎勵關卡";
        this.rewardElement.classList.remove("square");
        this.rewardElement.style.backgroundImage = "";
        if (rewardHref && rewardHref === "bouncermode") {
            this.textElement.innerHTML = "解鎖彈撞模式 :)";
            this.rewardElement.innerHTML = "玩彈撞模式";
        }
        else if (rewardHref && rewardHref.startsWith("animal-")) {
            this.rewardElement.innerHTML = "";
            this.rewardElement.classList.add("square");
            this.rewardElement.style.backgroundImage = "url('./datas/icons-bb/pets/" + rewardHref + ".png')";
            this.textElement.innerHTML = "獲得 " + (BB_PET_NAMES[rewardHref.replace("animal-", "")] || rewardHref.replace("animal-", "")) + " 玩具！</br>（Kenney 製作）";
            this.textElement.classList.add("inline");
        }
    }
    totalStarsToThresholdIndex(totalStars) {
        let index = 0;
        while (totalStars >= this.thresholds[index]) {
            index++;
        }
        return index;
    }
    async updateTotalStars() {
        let newStarsCount = this.bbPuzzle.game.bbPuzzleLoader.getTotalStarsCount();
        let delta = newStarsCount - this.totalCollectedStars;
        if (delta > 0) {
            await this.addStars(Math.round(delta));
        }
        let currentCollectedStars = this.totalCollectedStars - this.currentStarsOffset;
        if (currentCollectedStars >= this.starElements.length) {
            let rewardIndex = this.currentThresholdIndex;
            this.initialize();
            this.showReward(rewardIndex);
        }
    }
    async addStars(n) {
        let step = async (starElement) => {
            return new Promise(resolve => {
                starElement.classList.remove("inactive");
                starElement.classList.add("new");
                BBPuzzleAnimator.PopStar(starElement, 1);
                setTimeout(() => {
                    resolve();
                }, 500);
            });
        };
        return new Promise(resolve => {
            setTimeout(async () => {
                for (let i = 0; i < n; i++) {
                    let starElement = this.starElements[this.totalCollectedStars - this.currentStarsOffset];
                    if (starElement) {
                        this.totalCollectedStars++;
                        this.titleElement.innerHTML = "進度 - " + this.totalCollectedStars.toFixed(0) + " / " + this.thresholds[this.currentThresholdIndex].toFixed(0);
                        await step(starElement);
                    }
                }
                resolve();
            }, 1000);
        });
    }
}
class BBPuzzleScoreBoardDigit extends BABYLON.Mesh {
    constructor(board, n) {
        super("bb-puzzle-score-board-" + n.toFixed(0));
        this.board = board;
        this.n = n;
        this.value = 0;
        this.speed = 0.01;
        this._mustRotate = false;
        this.update = () => {
            if (!this.isVisible) {
                return;
            }
            if (this.value != this.currentFrontValue && this.value === this.currentBackValue) {
                this._mustRotate = true;
            }
            if (this._mustRotate) {
                let positive = this.rotation.x >= 0;
                this.rotation.x += this.speed;
                if (positive && this.rotation.x > Math.PI) {
                    this.rotation.x = -Math.PI;
                    this._mustRotate = false;
                }
                else if (!positive && this.rotation.x > 0) {
                    this.rotation.x = 0;
                    this._mustRotate = false;
                }
            }
        };
        Core.MainMaterials.SetAsOutlinedMesh(this);
        let fSpeed = Math.floor(n / 4);
        this.speed = 0.1 * (1 - fSpeed) + 0.01 * fSpeed;
        this.currentFrontSticker = new BABYLON.InstancedMesh("front-sticker-" + this.n.toFixed(0), this.board.numberStickers[0]);
        this.currentFrontSticker.parent = this;
        this.currentFrontSticker.position.copyFromFloats(0, 0, 0);
        this.currentFrontSticker.position.z = -0.007;
        this.currentFrontValue = 0;
        this.currentBackSticker = new BABYLON.InstancedMesh("back-sticker-" + this.n.toFixed(0), this.board.numberStickers[0]);
        this.currentBackSticker.parent = this;
        this.currentBackSticker.position.copyFromFloats(0, 0, 0);
        this.currentBackSticker.position.z = 0.007;
        this.currentBackSticker.rotation.x = Math.PI;
        this.currentBackValue = 0;
        this._scene.onBeforeRenderObservable.add(this.update);
    }
    get currentFrontSticker() {
        let rx = this.rotation.x;
        if (rx > -Math.PI * 0.5 && rx <= Math.PI * 0.5) {
            return this.frontSticker;
        }
        return this.backSticker;
    }
    set currentFrontSticker(m) {
        let rx = this.rotation.x;
        if (rx > -Math.PI * 0.5 && rx <= Math.PI * 0.5) {
            this.frontSticker = m;
        }
        else {
            this.backSticker = m;
        }
    }
    get currentFrontValue() {
        let rx = this.rotation.x;
        if (rx > -Math.PI * 0.5 && rx <= Math.PI * 0.5) {
            return this.frontValue;
        }
        return this.backValue;
    }
    set currentFrontValue(v) {
        let rx = this.rotation.x;
        if (rx > -Math.PI * 0.5 && rx <= Math.PI * 0.5) {
            this.frontValue = v;
        }
        else {
            this.backValue = v;
        }
    }
    get currentBackSticker() {
        let rx = this.rotation.x;
        if (rx > -Math.PI * 0.5 && rx <= Math.PI * 0.5) {
            return this.backSticker;
        }
        return this.frontSticker;
    }
    set currentBackSticker(m) {
        let rx = this.rotation.x;
        if (rx > -Math.PI * 0.5 && rx <= Math.PI * 0.5) {
            this.backSticker = m;
        }
        else {
            this.frontSticker = m;
        }
    }
    get currentBackValue() {
        let rx = this.rotation.x;
        if (rx > -Math.PI * 0.5 && rx <= Math.PI * 0.5) {
            return this.backValue;
        }
        return this.frontValue;
    }
    set currentBackValue(v) {
        let rx = this.rotation.x;
        if (rx > -Math.PI * 0.5 && rx <= Math.PI * 0.5) {
            this.backValue = v;
        }
        else {
            this.frontValue = v;
        }
    }
    setValue(v) {
        if (v != this.value) {
            let p = this.currentBackSticker.position;
            let r = this.currentBackSticker.rotation;
            if (this.currentBackSticker) {
                this.currentBackSticker.dispose();
            }
            this.value = v;
            this.currentBackSticker = new BABYLON.InstancedMesh("front-sticker-" + this.n.toFixed(0), this.board.numberStickers[this.value]);
            this.currentBackSticker.parent = this;
            this.currentBackSticker.position.copyFrom(p);
            this.currentBackSticker.rotation.copyFrom(r);
            this.currentBackValue = this.value;
            this._mustRotate = true;
        }
    }
    setIsVisible(v) {
        this.isVisible = v;
        if (this.frontSticker) {
            this.frontSticker.isVisible = v;
        }
        if (this.backSticker) {
            this.backSticker.isVisible = v;
        }
    }
}
class BBPuzzleScoreBoard extends BABYLON.Mesh {
    constructor(bbPuzzle) {
        super("bb-puzzle-score-board");
        this.bbPuzzle = bbPuzzle;
        this.digits = [];
        this.numberStickers = [];
        this._score = 0;
        for (let n = 0; n <= 9; n++) {
            let numero = n;
            let material = new BABYLON.StandardMaterial("sticker");
            material.specularColor.copyFromFloats(0, 0, 0);
            let texture = new BABYLON.DynamicTexture("tex", 128, undefined, true);
            texture.hasAlpha = true;
            let context = texture.getContext();
            context.clearRect(0, 0, 256, 256);
            // test
            //context.fillStyle = "#ffffff";
            //context.fillRect(0, 0, 256, 256);
            // test
            context.strokeStyle = "#000000";
            context.fillStyle = "#ffffff";
            context.font = "90px BigBottomCartoon";
            context.lineWidth = 16;
            context.strokeText(numero.toFixed(0), 28, 119);
            context.fillText(numero.toFixed(0), 28, 119);
            texture.update();
            material.diffuseTexture = texture;
            material.emissiveColor.copyFromFloats(1, 1, 1);
            material.useAlphaFromDiffuseTexture = false;
            let sticker = BABYLON.MeshBuilder.CreatePlane("sticker-" + numero.toFixed(0), { size: 0.02 });
            sticker.material = material;
            sticker.position.y = -10;
            this.numberStickers.push(sticker);
        }
        for (let n = 0; n < 5; n++) {
            let digit = new BBPuzzleScoreBoardDigit(this, n);
            Mummu.CreateBeveledBoxVertexData({
                width: 0.021,
                height: 0.030,
                depth: 0.01
            }).applyToMesh(digit);
            digit.parent = this;
            digit.position.x = -((n / 4) - 0.5) * 0.024 * 4;
            digit.position.y = 0.030 / 2;
            digit.material = this.bbPuzzle.game.materials.getMaterial(9, Core.MaterialQuality.PBR);
            this.digits[n] = digit;
        }
        this.setIsVisible(false);
    }
    setIsVisible(v) {
        this.isVisible = v;
        this.digits.forEach(digit => {
            digit.setIsVisible(v);
        });
    }
    getScore() {
        return this._score;
    }
    setScore(s) {
        if (this._score != s) {
            this._score = s;
            let tmpS = Math.floor(s);
            for (let n = 0; n < this.digits.length; n++) {
                this.digits[n].setValue(tmpS % 10);
                tmpS = Math.floor(tmpS / 10);
            }
        }
    }
}
class BBPuzzleTutorial {
    constructor(bbPuzzle) {
        this.bbPuzzle = bbPuzzle;
        this.displayText = false;
        this.playState = 0;
        this.oked = false;
        this.aborted = false;
        this._run = async () => { };
        this.container = document.querySelector("#bb-puzzle-dialog-container");
        this.container.onpointerup = (e) => {
            e.stopPropagation();
        };
        this.container.onpointerdown = (e) => {
            e.stopPropagation();
        };
        this.textElement = document.querySelector("#bb-puzzle-dialog-container .text");
        this.okButton = document.querySelector("#bb-puzzle-dialog-container .btn-ok");
        this.okButton.onclick = () => {
            this.oked = true;
        };
        let audioElement = document.querySelector("#voice-click");
        //let audioContext = new AudioContext();
        //let clickTrack = audioContext.createMediaElementSource(audioElement);
        //clickTrack.connect(audioContext.destination);
    }
    get lowPerfText() {
        return this.game.getGraphicQ() < Core.GraphicQuality.High;
    }
    get game() {
        return this.bbPuzzle.game;
    }
    async runTutorial() {
        this.aborted = false;
        this.oked = false;
        this.softSkipped = undefined;
        this.playState = 0;
        await this._run();
    }
    async waitForNextFrame() {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                resolve();
            });
        });
    }
    async waitForCondition(conditionCallback) {
        return new Promise(resolve => {
            let checkStep = () => {
                if (conditionCallback()) {
                    resolve();
                }
                else {
                    requestAnimationFrame(checkStep);
                }
            };
            checkStep();
        });
    }
    async waitForResult(resultCallback) {
        return new Promise(resolve => {
            let checkStep = () => {
                let v = resultCallback();
                if (v != -1) {
                    resolve(v);
                }
                else {
                    requestAnimationFrame(checkStep);
                }
            };
            checkStep();
        });
    }
    async showText(text, durationAfterDraw = 1000, onlyText = false) {
        let wait = (t) => {
            return new Promise(resolve => {
                setTimeout(resolve, t);
            });
        };
        if (!this.displayText) {
            if (!onlyText) {
                await wait(durationAfterDraw);
            }
            return;
        }
        if (this.lowPerfText) {
            return this.showTextCheap(text, durationAfterDraw);
        }
        let audioElement = document.querySelector("#voice-click");
        let charDT = 20;
        let trueDuration = durationAfterDraw + charDT * text.length;
        this.oked = false;
        return new Promise(resolve => {
            if (VERBORSE_TUTORIAL_LOG) {
                console.log(text);
            }
            this.container.style.display = "block";
            if (!document.body.classList.contains("vertical")) {
                this.bbPuzzle.titleElement.style.display = "none";
            }
            let index = -1;
            let t0 = performance.now();
            let step = async () => {
                if (this.softSkipped && this.softSkipped()) {
                    trueDuration = Math.min(200, durationAfterDraw) + charDT * text.length;
                }
                let f = (performance.now() - t0) / trueDuration;
                let currIndex = Math.floor((performance.now() - t0) / charDT);
                currIndex = Math.min(currIndex, text.length);
                if (currIndex != index) {
                    if (currIndex % 3 === 0) {
                        audioElement.currentTime = 0;
                        audioElement.playbackRate = 0.5 + 1 * Math.random();
                        audioElement.play();
                    }
                    let visiblePart = "";
                    if (currIndex === 1) {
                        visiblePart = text[0];
                    }
                    else if (currIndex >= 2) {
                        visiblePart = text.slice(0, currIndex);
                    }
                    let visibleBCount = 0;
                    while (visiblePart.indexOf("*") != -1) {
                        if (visibleBCount % 2 === 0) {
                            visiblePart = visiblePart.replace("*", "<b>");
                        }
                        else {
                            visiblePart = visiblePart.replace("*", "</b>");
                        }
                        visibleBCount++;
                    }
                    if (visibleBCount % 2 === 1) {
                        visiblePart += "</b>";
                    }
                    /*
                    let hiddenPart = "";
                    let hiddenBCount = 0;
                    if (visibleBCount % 2 === 1) {
                        hiddenPart = "<b>";
                        hiddenBCount = 1;
                    }
                    if (currIndex === text.length - 1) {
                        hiddenPart = "" + text[text.length - 1];
                    }
                    else if (currIndex <= text.length - 2) {
                        hiddenPart = "" + text.slice(currIndex);
                    }
                    while (hiddenPart.indexOf("*") != -1) {
                        if (hiddenBCount % 2 === 0) {
                            hiddenPart = hiddenPart.replace("*", "<b>");
                        }
                        else {
                            hiddenPart = hiddenPart.replace("*", "</b>");
                        }
                        hiddenBCount++;
                    }
                    if (hiddenBCount % 2 === 1) {
                        hiddenPart += "</b>";
                    }
                    */
                    this.container.querySelector(".text .visible").innerHTML = visiblePart;
                    //this.container.querySelector(".text .hidden").innerHTML = hiddenPart;
                    index = currIndex;
                }
                if (f > 1 || this.oked) {
                    this.container.style.display = "none";
                    this.bbPuzzle.titleElement.style.display = "block";
                    resolve();
                }
                else {
                    requestAnimationFrame(step);
                }
            };
            step();
        });
    }
    async showTextCheap(text, durationAfterDraw = 1000) {
        text = text.replaceAll("*", "");
        let charDT = 20;
        let trueDuration = durationAfterDraw + charDT * text.length;
        this.oked = false;
        return new Promise(resolve => {
            if (VERBORSE_TUTORIAL_LOG) {
                console.log(text);
            }
            this.container.style.display = "block";
            this.container.querySelector(".text .visible").textContent = text;
            if (!document.body.classList.contains("vertical")) {
                this.bbPuzzle.titleElement.style.display = "none";
            }
            let t0 = performance.now();
            let step = async () => {
                if (this.softSkipped && this.softSkipped()) {
                    trueDuration = Math.min(200, durationAfterDraw) + charDT * text.length;
                }
                let f = (performance.now() - t0) / trueDuration;
                if (f > 1 || this.oked) {
                    this.container.style.display = "none";
                    this.bbPuzzle.titleElement.style.display = "block";
                    resolve();
                }
                else {
                    requestAnimationFrame(step);
                }
            };
            step();
        });
    }
    async showTextWordByWord(text, duration = 5000) {
        let audioElement = document.querySelector("#voice-click");
        this.oked = false;
        return new Promise(resolve => {
            this.container.style.display = "block";
            if (!document.body.classList.contains("vertical")) {
                this.bbPuzzle.titleElement.style.display = "none";
            }
            let split = text.split(" ");
            let index = -1;
            let t0 = performance.now();
            let step = () => {
                let f = (performance.now() - t0) / duration;
                let currIndex = Math.floor((performance.now() - t0) / 80);
                currIndex = Math.min(currIndex, split.length);
                let fullDisplayed = currIndex === split.length;
                if (currIndex != index) {
                    audioElement.play();
                    let visiblePart = "";
                    if (currIndex === 1) {
                        visiblePart = split[0];
                    }
                    else if (currIndex >= 2) {
                        visiblePart = split.slice(0, currIndex).reduce((s1, s2) => { return s1 + " " + s2; });
                    }
                    let hiddenPart = "";
                    if (currIndex === split.length - 1) {
                        hiddenPart = " " + split[split.length - 1];
                    }
                    else if (currIndex <= split.length - 2) {
                        hiddenPart = " " + split.slice(currIndex).reduce((s1, s2) => { return s1 + " " + s2; });
                    }
                    this.container.querySelector(".text .visible").innerHTML = visiblePart;
                    this.container.querySelector(".text .hidden").innerHTML = hiddenPart;
                    index = currIndex;
                }
                if (f > 1 || this.oked) {
                    this.container.style.display = "none";
                    this.bbPuzzle.titleElement.style.display = "block";
                    resolve();
                }
                else {
                    requestAnimationFrame(step);
                }
            };
            step();
        });
    }
    async highLightMesh(text, mesh, offset, duration = 5000) {
        this.oked = false;
        return new Promise(resolve => {
            let mark = document.createElement("div");
            mark.classList.add("bb-puzzle-tutorial-mark");
            mark.innerHTML = text;
            document.body.appendChild(mark);
            let t0 = performance.now();
            let step = () => {
                let f = (performance.now() - t0) / duration;
                let anchor = mesh.position.add(offset);
                let pos = BABYLON.Vector3.Project(anchor, //vector to project
                BABYLON.Matrix.Identity(), //world matrix
                this.game.scene.getTransformMatrix(), //transform matrix
                this.game.arcCamera.viewport);
                if (pos.x <= 0.5) {
                    mark.style.left = (pos.x * 100).toFixed(1) + "vw";
                    mark.style.right = "";
                    mark.classList.add("bb-puzzle-tutorial-mark-left");
                }
                else {
                    mark.style.left = "";
                    mark.style.right = ((1 - pos.x) * 100).toFixed(1) + "vw";
                    mark.classList.add("bb-puzzle-tutorial-mark-right");
                }
                mark.style.bottom = ((1 - pos.y) * 100).toFixed(1) + "svh";
                if (f > 1 || this.oked) {
                    document.body.removeChild(mark);
                    resolve();
                }
                else {
                    requestAnimationFrame(step);
                }
            };
            step();
        });
    }
    abort() {
        this.oked = true;
        this.aborted = true;
    }
}
var VERBORSE_TUTORIAL_LOG = false;
var BBPuzzleTutorialsList = [];
BBPuzzleTutorialsList["bb-puzzle-easy-golf"] = (bbPuzzle) => {
    let tuto = new BBPuzzleTutorial(bbPuzzle);
    tuto._run = async () => {
        let d = 2500;
        let ball = tuto.game.machine.balls[0];
        tuto.bbPuzzle.hintsActivated = true;
        tuto.bbPuzzle.showHints();
        tuto.bbPuzzle.runAllHints(true);
        await tuto.waitForCondition(() => {
            if (tuto.bbPuzzle.getCurrentBBElementCount() > 0) {
                let line = tuto.bbPuzzle.blackboard.bbElements[0];
                let start = line.points[0];
                let end = line.points[line.points.length - 1];
                if (end.y < start.y + 0.005) {
                    if (start.x < ball.position.x - 0.005 && end.x > ball.position.x + 0.005) {
                        return true;
                    }
                }
            }
            return false;
        });
        tuto.bbPuzzle.hideHints();
        tuto.softSkipped = undefined;
        let result = await tuto.waitForResult(() => {
            if (tuto.playState === 1) {
                return 1;
            }
            else if (tuto.playState === 2) {
                return 2;
            }
            return -1;
        });
        let done = false;
        while (!done) {
            if (result === 1) {
                done = true;
                await tuto.waitForNextFrame();
                tuto.bbPuzzle.win();
            }
            else if (result === 2) {
                tuto.bbPuzzle.undoButton.classList.add("hinted");
                await tuto.waitForNextFrame();
            }
            tuto.playState = 0;
            result = await tuto.waitForResult(() => {
                if (tuto.playState === 1) {
                    return 1;
                }
                else if (tuto.playState === 2) {
                    return 2;
                }
                return -1;
            });
        }
    };
    return tuto;
};
BBPuzzleTutorialsList["bb-puzzle-two-tracks"] = (bbPuzzle) => {
    let tuto = new BBPuzzleTutorial(bbPuzzle);
    tuto._run = async () => {
        let d = 2500;
        tuto.softSkipped = () => { return tuto.bbPuzzle.getCurrentBBElementCount() >= 2; };
        await tuto.showText("你表現得*很棒*！繼續吧！", d, true);
        if (tuto.aborted) {
            return;
        }
        ;
        await tuto.showText("這次你需要使用*兩段軌道*來破解謎題。", d, true);
        if (tuto.aborted) {
            return;
        }
        ;
        let star = tuto.game.machine.parts.find(part => { return part instanceof Core.Star; });
        if (star) {
            star.flash();
            //tuto.highLightMesh("STAR", star, new BABYLON.Vector3(0.01, 0.01, 0), d);
            await tuto.showText("你注意到*星星*了嗎？何不試著*接住它*？", d);
            star.stopFlash();
        }
        if (tuto.aborted) {
            return;
        }
        ;
        await tuto.showText("讓*彈珠*撞上*星星*，就能獲得獎勵！", d, true);
        if (tuto.aborted) {
            return;
        }
        ;
        await tuto.waitForCondition(() => {
            return tuto.bbPuzzle.getCurrentBBElementCount() >= 2 || tuto.bbPuzzle.getCurrentBBElementCount() >= 1 && tuto.game.machine.playing;
        });
        tuto.softSkipped = () => { return tuto.game.machine.playing; };
        await tuto.showText("按「*開始*」讓彈珠滾動。", d);
        if (tuto.aborted) {
            return;
        }
        ;
        tuto.softSkipped = undefined;
        let result = await tuto.waitForResult(() => {
            if (tuto.playState === 1) {
                return 1;
            }
            else if (tuto.playState === 2) {
                return 2;
            }
            return -1;
        });
        let done = false;
        while (!done) {
            if (result === 1) {
                done = true;
                await tuto.showText("*做得好！*", d, true);
                if (tuto.aborted) {
                    return;
                }
                ;
                tuto.bbPuzzle.win();
            }
            else if (result === 2) {
                tuto.bbPuzzle.undoButton.classList.add("hinted");
                await tuto.showText("出了點問題…也許可以再試一次？", d);
                if (tuto.aborted) {
                    return;
                }
                ;
            }
            tuto.playState = 0;
            result = await tuto.waitForResult(() => {
                if (tuto.playState === 1) {
                    return 1;
                }
                else if (tuto.playState === 2) {
                    return 2;
                }
                return -1;
            });
        }
    };
    return tuto;
};
BBPuzzleTutorialsList["bb-puzzle-easy-s-curve"] = (bbPuzzle) => {
    let tuto = new BBPuzzleTutorial(bbPuzzle);
    tuto._run = async () => {
        bbPuzzle.onWin = () => {
            bbPuzzle.win();
        };
        bbPuzzle.onFail = () => {
            bbPuzzle.undoButton.classList.add("hinted");
        };
        let d = 2500;
        tuto.softSkipped = () => { return tuto.bbPuzzle.getCurrentBBElementCount() >= 3; };
        tuto.bbPuzzle.materialCounter.container.classList.add("hinted");
        await tuto.showText("看右邊的*材料計數器*。", d, true);
        if (tuto.aborted) {
            return;
        }
        ;
        await tuto.showText("若能在不使用過多*軌道*的情況下完成謎題，", d, true);
        if (tuto.aborted) {
            return;
        }
        ;
        tuto.bbPuzzle.materialCounter.container.classList.remove("hinted");
        await tuto.showText("就能贏得*獎勵星星*！", d, true);
        if (tuto.aborted) {
            return;
        }
        ;
        await tuto.waitForCondition(() => {
            return tuto.bbPuzzle.getCurrentBBElementCount() > 0;
        });
    };
    return tuto;
};
BBPuzzleTutorialsList["bb-puzzle-easy-aim"] = (bbPuzzle) => {
    let tuto = new BBPuzzleTutorial(bbPuzzle);
    tuto._run = async () => {
        bbPuzzle.onWin = () => {
            bbPuzzle.win();
        };
        bbPuzzle.onFail = () => {
            bbPuzzle.undoButton.classList.add("hinted");
        };
        let d = 2500;
        tuto.softSkipped = () => { return tuto.bbPuzzle.getCurrentBBElementCount() >= 3; };
        await tuto.showText("這顆*星星*可能很難拿到。", d, true);
        if (tuto.aborted) {
            return;
        }
        ;
        await tuto.showText("拿不到也別擔心，還有很多其他*星星*可以收集！", d, true);
        if (tuto.aborted) {
            return;
        }
        ;
        await tuto.showText("祝你好運！", d, true);
        if (tuto.aborted) {
            return;
        }
        ;
        await tuto.waitForCondition(() => {
            return tuto.bbPuzzle.getCurrentBBElementCount() > 0;
        });
    };
    return tuto;
};
BBPuzzleTutorialsList["bb-puzzle-bonus-easy-zig-zag"] = (bbPuzzle) => {
    let tuto = new BBPuzzleTutorial(bbPuzzle);
    tuto._run = async () => {
        let d = 3000;
        tuto.softSkipped = () => { return tuto.bbPuzzle.getCurrentBBElementCount() > 0; };
        await tuto.showText("再來做個實驗吧！", d, true);
        if (tuto.aborted) {
            return;
        }
        ;
        await tuto.showText("這麼多障礙物之間，彈珠能抵達終點嗎？", d, true);
        if (tuto.aborted) {
            return;
        }
        ;
        await tuto.showText("和之前一樣，在畫板上畫出*軌道*！", d, true);
        if (tuto.aborted) {
            return;
        }
        ;
        await tuto.waitForCondition(() => {
            return tuto.bbPuzzle.getCurrentBBElementCount() > 0;
        });
        tuto.softSkipped = () => { return tuto.game.machine.playing; };
        await tuto.showText("好，試試看，按「*開始*」讓彈珠滾動。", d, true);
        if (tuto.aborted) {
            return;
        }
        ;
        tuto.softSkipped = undefined;
        let result = await tuto.waitForResult(() => {
            if (tuto.playState === 1) {
                return 1;
            }
            else if (tuto.playState === 2) {
                return 2;
            }
            return -1;
        });
        let done = false;
        while (!done) {
            if (result === 1) {
                done = true;
                await tuto.showText("*做得好！*成功了！你可以讓彈珠沿著障礙物滾到終點！", d, true);
                if (tuto.aborted) {
                    return;
                }
                ;
                tuto.bbPuzzle.win();
            }
            else if (result === 2) {
                tuto.bbPuzzle.undoButton.classList.add("hinted");
                await tuto.showText("出了點問題…也許可以再試一次？", d, true);
                if (tuto.aborted) {
                    return;
                }
                ;
            }
            tuto.playState = 0;
            result = await tuto.waitForResult(() => {
                if (tuto.playState === 1) {
                    return 1;
                }
                else if (tuto.playState === 2) {
                    return 2;
                }
                return -1;
            });
        }
    };
    return tuto;
};
var DefaultTutorial1 = (bbPuzzle) => {
    let tuto = new BBPuzzleTutorial(bbPuzzle);
    tuto._run = async () => {
        bbPuzzle.onWin = () => {
            bbPuzzle.win();
        };
        bbPuzzle.onFail = () => {
            bbPuzzle.undoButton.classList.add("hinted");
        };
        let d = 2500;
        tuto.softSkipped = () => { return tuto.bbPuzzle.getCurrentBBElementCount() >= 3; };
        await tuto.showText("看右邊的*材料計數器*。", d, true);
        if (tuto.aborted) {
            return;
        }
        ;
        await tuto.showText("若能在不使用過多*軌道*的情況下完成謎題，", d, true);
        if (tuto.aborted) {
            return;
        }
        ;
        await tuto.showText("就能贏得*獎勵星星*！", d, true);
        if (tuto.aborted) {
            return;
        }
        ;
        await tuto.waitForCondition(() => {
            return tuto.bbPuzzle.getCurrentBBElementCount() > 0;
        });
    };
    return tuto;
};
/*
BBPuzzleTutorialsList["bb-puzzle-easy-bumper"] = (bbPuzzle: BlackBoardPuzzle) => {
    let tuto = new BBPuzzleTutorial(bbPuzzle);
    tuto._run = async () => {
        let d = 2500;

        tuto.softSkipped = () => { return tuto.bbPuzzle.getCurrentBBElementCount() > 0; };
        await tuto.showText("你好！歡迎來到*彈珠重力實驗室*。", d, true);
        if (tuto.aborted) { return; };

        await tuto.showText("我是*P 教授*，重力實驗室的負責人，幸會。", d, true);
        if (tuto.aborted) { return; };
        
        tuto.bbPuzzle.hintsActivated = true;
        tuto.bbPuzzle.showHints();
        tuto.bbPuzzle.runAllHints(true);
        await tuto.showText("這次用*彈撞*把彈珠彈開。", d);
        if (tuto.aborted) { return; };
        await tuto.waitForCondition(() => {
            return tuto.bbPuzzle.getCurrentBBElementCount() > 0;
        })

        tuto.softSkipped = () => { return tuto.game.machine.playing; };
        await tuto.showText("很好，現在按「*開始*」讓彈珠滾動。", d, true);
        if (tuto.aborted) { return; };

        tuto.softSkipped = undefined;
        let result = await tuto.waitForResult(() => {
            if (tuto.playState === 1) {
                return 1;
            }
            else if (tuto.playState === 2) {
                return 2;
            }
            return -1;
        })

        let done = false;
        while (!done) {
            if (result === 1) {
                done = true;
                await tuto.showText("*做得好！*成功了！重力讓彈珠沿軌道滾動。", d, true);
                if (tuto.aborted) { return; };
                tuto.bbPuzzle.win();
            }
            else if (result === 2) {
                tuto.bbPuzzle.undoButton.classList.add("hinted");
                await tuto.showText("出了點問題…也許可以再試一次？", d, true);
                if (tuto.aborted) { return; };
            }
                
            tuto.playState = 0;
            result = await tuto.waitForResult(() => {
                if (tuto.playState === 1) {
                    return 1;
                }
                else if (tuto.playState === 2) {
                    return 2;
                }
                return -1;
            });
        }
    }
    return tuto;
}
*/ 
var BB_PUZZLES_LEVELS = [
    "bb-puzzle-easy-golf",
    "bb-puzzle-easy-golf",
    //"bb-puzzle-easy-bumper",
    "bb-puzzle-two-tracks",
    "bb-puzzle-easy-s-curve",
    "bb-puzzle-easy-aim",
    "bb-puzzle-one-switch",
    "bb-puzzle-jump",
    "bb-puzzle-nice-switch",
    "bb-puzzle-easy-funnel",
    "bb-puzzle-easy-two-tracks",
    "bb-puzzle-dual-drop",
    "bb-puzzle-simple-cross",
    "bb-puzzle-drop",
    "bb-puzzle-easy-switch",
    "bb-puzzle-hook",
    "bb-puzzle-around",
    "bb-puzzle-golf-bounce",
    "bb-puzzle-easy-around",
    "bb-puzzle-billard",
    "bb-puzzle-dip-and-jump",
    "bb-puzzle-travel",
    "bb-puzzle-three-balls-one-stone",
    "bb-puzzle-down-and-up",
    "bb-puzzle-split-bounce",
    "bb-puzzle-easy-travel",
    "bb-puzzle-cross",
    "bb-puzzle-black-bounce",
    "bb-puzzle-bird",
    "bb-puzzle-double-hook",
    "bb-puzzle-complex-switch",
];
var BB_PUZZLES_LEVELS_CLAUDE = [
    "bb-puzzle-easy-golf",
    "bb-puzzle-easy-golf",
    "bb-puzzle-two-tracks",
    "bb-puzzle-easy-s-curve",
    "bb-puzzle-easy-aim",
    "bb-puzzle-easy-funnel",
    "bb-puzzle-one-switch",
    "bb-puzzle-jump",
    "bb-puzzle-nice-switch",
    "bb-puzzle-easy-two-tracks",
    "bb-puzzle-dual-drop",
    "bb-puzzle-simple-cross",
    "bb-puzzle-drop",
    "bb-puzzle-easy-switch",
    "bb-puzzle-hook",
    "bb-puzzle-easy-around",
    "bb-puzzle-golf-bounce",
    "bb-puzzle-around",
    "bb-puzzle-billard",
    "bb-puzzle-easy-travel",
    "bb-puzzle-dip-and-jump",
    "bb-puzzle-travel",
    "bb-puzzle-three-balls-one-stone",
    "bb-puzzle-down-and-up",
    "bb-puzzle-split-bounce",
    "bb-puzzle-cross",
    "bb-puzzle-black-bounce",
    "bb-puzzle-bird",
    "bb-puzzle-double-hook",
    "bb-puzzle-complex-switch",
];
var BB_PUZZLES_BONUS_LEVELS = [
    "bb-puzzle-bonus-easy-zig-zag",
    "bb-puzzle-bonus-easy-zig-zag",
    "bb-puzzle-bonus-split"
];
var BB_PUZZLES_TOTAL_COUNT = 2 * (BB_PUZZLES_LEVELS.length - 1) + (BB_PUZZLES_BONUS_LEVELS.length - 1);
function IndexToBBPuzzleLevel(index, isBonus) {
    let postFix = "";
    if (index >= 1000) {
        index -= 1000;
        postFix = "-bouncermode";
    }
    if (isBonus) {
        return BB_PUZZLES_BONUS_LEVELS[index] + postFix;
    }
    return BB_PUZZLES_LEVELS[index] + postFix;
}
var BBDrawMode;
(function (BBDrawMode) {
    BBDrawMode[BBDrawMode["None"] = 0] = "None";
    BBDrawMode[BBDrawMode["Path"] = 1] = "Path";
    BBDrawMode[BBDrawMode["Trampoline"] = 2] = "Trampoline";
    BBDrawMode[BBDrawMode["Bouncer"] = 3] = "Bouncer";
    BBDrawMode[BBDrawMode["Eraser"] = 4] = "Eraser";
})(BBDrawMode || (BBDrawMode = {}));
var Medal;
(function (Medal) {
    Medal[Medal["None"] = 0] = "None";
    Medal[Medal["Gold"] = 1] = "Gold";
    Medal[Medal["Silver"] = 2] = "Silver";
    Medal[Medal["Bronze"] = 3] = "Bronze";
})(Medal || (Medal = {}));
class BlackBoardPuzzle {
    constructor(game) {
        this.game = game;
        this.initialized = false;
        this.USE_PLAY_STOP_BUTTON_3D = false;
        this.ballTrajectoryMeshes = [];
        this.dev_AddStar = false;
        this.winzones = [];
        this.stars = [];
        this.ballsWinState = [];
        this.ballsPrevPosition = [];
        this.drawBlackboardPath = [];
        this.drawOffset = BABYLON.Vector3.Zero();
        this.drawMode = BBDrawMode.Bouncer;
        this.draggedBouncerAnchor = -1;
        this.isBonusLevel = false;
        this.index = 0;
        this.solutionLines = [];
        this.hints = [];
        this.targetMaterial = 30;
        this.targetDistance = 1;
        this.targetAirTime = 1;
        this.targetMaxSpeed = 0.8;
        this.linesCountLimit = 10;
        this.hintsActivated = false;
        this.completed = false;
        this.failed = false;
        this.stickers = [];
        this.ballStickersInstances = [];
        this.onWin = () => { };
        this.onFail = () => { };
        this._hintsRunning = false;
        this._updateVictoryStars = (count) => {
            for (let n = 0; n < count; n++) {
                if (this.scoreStars[n].classList.contains("inactive")) {
                    this.scoreStars[n].classList.remove("inactive");
                    this.scoreStars[n].classList.add("active");
                    BBPuzzleAnimator.PopStar(this.scoreStars[n], 1);
                    this.starSound.play();
                }
            }
        };
        this._successTimer = 0;
        this._failureTimer = 0;
        this._pointerDownCount = 0;
        this._pointerDownX = 0;
        this._pointerDownY = 0;
        this._pointerDown = (event) => {
            if (this.dev_AddStar) {
                return;
            }
            let pickingRay = this.game.scene.createPickingRay((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, BABYLON.Matrix.Identity(), this.game.arcCamera, false);
            let pick = this.game.scene.pickWithRay(pickingRay, (mesh) => {
                return mesh.parent instanceof Button || mesh instanceof ButtonWheelButtonMesh || mesh.parent instanceof BBPuzzlePet;
            });
            if (pick.hit && pick.pickedMesh.parent instanceof Button) {
                pick.pickedMesh.parent.onPointerDown();
                return;
            }
            if (pick.hit && pick.pickedMesh.parent instanceof BBPuzzlePet) {
                pick.pickedMesh.parent.randomMove();
                return;
            }
            if (!this.completed && !this.game.machine.playing) {
                this._clearAction();
                this._pointerDownX = (event.clientX - this.game.canvasLeft) * window.devicePixelRatio;
                this._pointerDownY = event.clientY * window.devicePixelRatio;
                this._pointerDownCount++;
                let pickingRay = this.game.scene.createPickingRay((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, BABYLON.Matrix.Identity(), this.game.arcCamera, false);
                let projIntersection = Mummu.RayPlaneIntersection(pickingRay, this.blackboard.position, BABYLON.Axis.Z);
                if (projIntersection.hit) {
                    let localPoint = projIntersection.point.subtract(this.blackboard.position);
                    if (this.drawMode === BBDrawMode.Bouncer) {
                        let bumperEditDistance = 0.01;
                        if (IsMobile) {
                            bumperEditDistance = 0.02;
                        }
                        for (let i = 0; i < this.blackboard.bumpers.length; i++) {
                            let bouncer = this.blackboard.bumpers[i];
                            let proj = Mummu.ProjectPointOnSegment(localPoint, bouncer.p0, bouncer.p1);
                            if (BABYLON.Vector3.Distance(localPoint, proj) < bumperEditDistance) {
                                this.draggedBouncer = bouncer;
                                this.draggedBouncerAnchor = -1;
                                if (BABYLON.Vector3.Distance(proj, bouncer.p0) < bumperEditDistance) {
                                    this.drawOffset.copyFrom(bouncer.p0).subtractInPlace(localPoint);
                                    this.draggedBouncerAnchor = 0;
                                }
                                else if (BABYLON.Vector3.Distance(proj, bouncer.p1) < bumperEditDistance) {
                                    this.drawOffset.copyFrom(bouncer.p1).subtractInPlace(localPoint);
                                    this.draggedBouncerAnchor = 1;
                                }
                                else {
                                    this.drawOffset.copyFrom(proj).subtractInPlace(localPoint);
                                }
                                this.setSelectedElement(bouncer);
                            }
                        }
                    }
                }
            }
        };
        this._pointerMove = (event) => {
            if (this.dev_AddStar) {
                return;
            }
            if (this._pointerDownCount === 1) {
                if (!this.completed && !this.game.machine.playing) {
                    let pickingRay = this.game.scene.createPickingRay((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, BABYLON.Matrix.Identity(), this.game.arcCamera, false);
                    let projIntersection = Mummu.RayPlaneIntersection(pickingRay, this.blackboard.position, BABYLON.Axis.Z);
                    if (projIntersection.hit) {
                        if (this.drawMode === BBDrawMode.Bouncer && this.draggedBouncer) {
                            projIntersection.point.addInPlace(this.drawOffset);
                            let dP = BABYLON.Vector3.Zero();
                            if (this.targetedPoint) {
                                dP.copyFrom(projIntersection.point).subtractInPlace(this.targetedPoint);
                            }
                            this.targetedPoint = projIntersection.point;
                            if (this.draggedBouncerAnchor === -1) {
                                this.draggedBouncer.p0.addInPlace(dP);
                                this.draggedBouncer.p1.addInPlace(dP);
                            }
                            else if (this.draggedBouncerAnchor === 0) {
                                this.draggedBouncer.p0.addInPlace(dP);
                            }
                            else if (this.draggedBouncerAnchor === 1) {
                                this.draggedBouncer.p1.addInPlace(dP);
                            }
                            this.draggedBouncer.updateMesh();
                            this.blackboard.refreshWorldMatrix();
                            this.onNextPointerUpOnce = () => {
                                this.saveCurrentState();
                            };
                        }
                        else if (this.drawMode === BBDrawMode.Eraser) {
                            let localPoint = projIntersection.point.subtract(this.blackboard.position);
                            if (this.blackboard.eraseLine(localPoint)) {
                                this.blackboard.regenerateTemplate();
                                this.blackboard.instantiate(true);
                                this.materialCounter.update();
                                this.onNextPointerUpOnce = () => {
                                    this.saveCurrentState();
                                };
                            }
                            else {
                                let bouncerIndex = this.blackboard.getBouncerIndexAt(localPoint);
                                if (bouncerIndex != -1) {
                                    this.blackboard.bumpers[bouncerIndex].dispose();
                                    this.materialCounter.update();
                                    this.onNextPointerUpOnce = () => {
                                        this.saveCurrentState();
                                    };
                                    this._clearAction();
                                }
                            }
                        }
                        else {
                            this.targetedPoint = projIntersection.point;
                        }
                    }
                }
                if (isFinite(this._pointerDownX) && isFinite(this._pointerDownY) && this._pointerDownCount === 1) {
                    //this.game.arcCamera.target.x -= event.movementX / 2000;
                    //this.game.arcCamera.target.y += event.movementY / 2000;
                }
            }
        };
        this._pointerUp = (event) => {
            this._pointerDownCount = 0;
            if (this.dev_AddStar) {
                let pickingRay = this.game.scene.createPickingRay((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, BABYLON.Matrix.Identity(), this.game.arcCamera, false);
                let projIntersection = Mummu.RayPlaneIntersection(pickingRay, this.blackboard.position, BABYLON.Axis.Z);
                if (projIntersection.hit) {
                    let i = Math.round(projIntersection.point.x / Core.tileSize);
                    let k = Math.round(projIntersection.point.y / Core.tileHeight);
                    let existingStar = this.game.machine.parts.find(part => {
                        return (part instanceof Core.Star) && part.i === i && part.k === k;
                    });
                    if (existingStar) {
                        existingStar.dispose();
                    }
                    else {
                        let star = this.game.machine.trackFactory.createTrack("star", {
                            fullPartName: "star",
                            i: i,
                            j: 0,
                            k: k,
                            r: 0,
                            c: [9]
                        });
                        star.instantiate();
                        this.game.machine.parts.push(star);
                    }
                }
                return;
            }
            let pickingRay = this.game.scene.createPickingRay((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, BABYLON.Matrix.Identity(), this.game.arcCamera, false);
            let pick = this.game.scene.pickWithRay(pickingRay, (mesh) => {
                return mesh.parent instanceof Button || mesh instanceof ButtonWheelButtonMesh;
            });
            if (pick.hit && pick.pickedMesh instanceof ButtonWheelButtonMesh) {
                pick.pickedMesh.onClick();
                return;
            }
            else if (pick.hit && pick.pickedMesh.parent instanceof Button) {
                pick.pickedMesh.parent.onPointerUp();
                return;
            }
            if (this.drawBlackboardPath.length > 0 && !this.completed && !this.game.machine.playing) {
                this.doDrawPathOnBlackboard();
            }
            if (this.onNextPointerUpOnce) {
                this.onNextPointerUpOnce();
                this.onNextPointerUpOnce = undefined;
            }
            this._clearAction();
        };
        this.play = () => {
            this.stars.forEach(star => {
                star.uncollect();
            });
            if (this.undoneGhost) {
                this.undoneGhost.dispose();
            }
            while (this.ballTrajectoryMeshes.length > 0) {
                this.ballTrajectoryMeshes.pop().dispose();
            }
            this.ballStickersInstances.forEach(ballStickerInstance => {
                ballStickerInstance.isVisible = false;
            });
            this.hideHints();
            this.game.machine.play();
            this.ballsWinState = [];
            this.ballsPrevPosition = [];
            for (let n = 0; n < this.game.machine.balls.length; n++) {
                let ball = this.game.machine.balls[n];
                this.ballsWinState[n] = false;
                this.ballsPrevPosition[n] = ball.positionZero.clone();
            }
        };
        this.stop = () => {
            if (this.game.machine.stopped) {
                return;
            }
            this.game.machine.stop();
            this.completed = false;
            this.failed = false;
            this._successTimer = 0;
            this._failureTimer = 0;
            this.stars.forEach(star => {
                star.uncollect();
            });
            if (this.hintsActivated) {
                this.showHints();
                this.runAllHints();
            }
            while (this.ballTrajectoryMeshes.length > 0) {
                this.ballTrajectoryMeshes.pop().dispose();
            }
            this.ballStickersInstances.forEach(ballStickerInstance => {
                ballStickerInstance.isVisible = true;
            });
            for (let i = 0; i < this.game.machine.balls.length; i++) {
                let ball = this.game.machine.balls[i];
                if (ball.saveTrajectory && ball.lastTrajectory.length >= 2) {
                    let material = this.game.materials.getBallMaterial(ball.materialIndex, this.game.getGraphicQ());
                    let color = BABYLON.Color3.White();
                    if (material instanceof BABYLON.StandardMaterial) {
                        color = material.diffuseColor;
                    }
                    if (material instanceof BABYLON.PBRMetallicRoughnessMaterial) {
                        color = material.baseColor;
                    }
                    let trajectoryMesh = new BABYLON.Mesh("ball-trajectory");
                    trajectoryMesh.material = this.game.materials.whiteFullLitMaterial;
                    let path = ball.lastTrajectory.map((p, i) => {
                        let f = i / (ball.lastTrajectory.length - 1);
                        p = p.clone();
                        p.z -= 0.005 * f;
                        return p;
                    });
                    let colors = path.map((p, i) => {
                        let f = i / (path.length - 1);
                        return new BABYLON.Color4(1 * (1 - f) + color.r * f, 1 * (1 - f) + color.g * f, 1 * (1 - f) + color.b * f, 0.5);
                    });
                    let data = Mummu.CreateTrailVertexData({
                        path: path,
                        colors: colors,
                        radius: 0.002,
                        up: new BABYLON.Vector3(0, 0, -1)
                    });
                    data.applyToMesh(trajectoryMesh, true);
                    this.ballTrajectoryMeshes.push(trajectoryMesh);
                }
            }
        };
        this._currentStateIndex = 0;
        this._savedStates = [];
        this.undo = () => {
            this.stop();
            this.undoButton.classList.remove("hinted");
            if (this.completed) {
                return;
            }
            if (this._currentStateIndex > 0) {
                this._currentStateIndex--;
                while (this.blackboard.bbElements.length > 0) {
                    this.blackboard.removeFirstElement();
                }
                let state = this._savedStates[this._currentStateIndex];
                state.lines.forEach(stateLine => {
                    new Core.BBLine(this.blackboard, stateLine);
                });
                state.bumpers.forEach(stateBumper => {
                    new Core.BBBouncer(this.blackboard, stateBumper.p0, stateBumper.p1);
                });
                this.blackboard.regenerateTemplate();
                this.blackboard.instantiate(true);
                this.materialCounter.update();
            }
        };
        this.help = () => {
            this.stop();
            if (!this.hintsActivated) {
                this.hintsActivated = true;
                this.showHints();
                this.runAllHints();
            }
            else {
                this.hintsActivated = false;
                this.hideHints();
            }
        };
        if (this.game.DEBUG_MODE) {
            this.debugMark = BABYLON.MeshBuilder.CreateBox("debug-mark", { size: 0.005 });
        }
        this.container = document.querySelector("#bb-puzzle-input-container");
        this.titleElement = this.container.querySelector("#bb-puzzle-title");
        this.titleLevelElement = this.container.querySelector("#bb-puzzle-title-level");
        this.titleNameElement = this.container.querySelector("#bb-puzzle-title-name");
        this.titleStarsElement = this.container.querySelector("#bb-puzzle-title-stars");
        this.playButton = this.container.querySelector("#bb-puzzle-play");
        this.playButton.onclick = this.play;
        this.bbPuzzlePet = new BBPuzzlePets(this);
        if (this.USE_PLAY_STOP_BUTTON_3D) {
            this.playStopButton3D = new Button(this.game);
            this.playStopButton3D.position.x = (10 - 1) * 0.5 * Core.tileSize;
            this.playStopButton3D.position.y = -0.02;
            this.playStopButton3D.position.z = -1.5 * Core.tileSize - 0.03;
            this.playStopButton3D.rotation.x = -Math.PI / 3;
            this.playButton3DMaterial = new BABYLON.StandardMaterial("material");
            this.playButton3DMaterial.diffuseTexture = new BABYLON.Texture("./datas/icons-bb/play.png");
            this.playButton3DMaterial.diffuseTexture.hasAlpha = true;
            this.playButton3DMaterial.diffuseTexture.wrapU = 0;
            this.playButton3DMaterial.diffuseTexture.wrapV = 0;
            this.playButton3DMaterial.specularColor.copyFromFloats(0.1, 0.1, 0.1);
            this.playStopButton3D.button.material = this.playButton3DMaterial;
            this.stopButton3DMaterial = new BABYLON.StandardMaterial("material");
            this.stopButton3DMaterial.diffuseTexture = new BABYLON.Texture("./datas/icons-bb/stop.png");
            this.stopButton3DMaterial.diffuseTexture.hasAlpha = true;
            this.stopButton3DMaterial.diffuseTexture.wrapU = 0;
            this.stopButton3DMaterial.diffuseTexture.wrapV = 0;
            this.stopButton3DMaterial.specularColor.copyFromFloats(0.1, 0.1, 0.1);
            this.playStopButton3D.button.material = this.stopButton3DMaterial;
            this.playStopButton3D.instantiate().then(() => {
                this.playStopButton3D.show();
            });
            this.playStopButton3D.onPointerDownCallback = () => {
                if (this.game.machine.playing) {
                    this.stop();
                }
                else {
                    this.play();
                }
            };
        }
        this.bottomButtonsContainer = this.container.querySelector("#bb-puzzle-bottom-buttons");
        this.stopButton = this.container.querySelector("#bb-puzzle-stop");
        this.stopButton.onclick = this.stop;
        this.undoButton = this.container.querySelector("#bb-puzzle-undo");
        this.undoButton.onclick = this.undo;
        this.helpButton = this.container.querySelector("#bb-puzzle-help");
        this.helpButton.onclick = this.help;
        this.skipButton = this.container.querySelector("#bb-puzzle-skip");
        this.skipButton.onclick = () => {
            location.href = "#bb-puzzle-" + (this.index + 1).toFixed(0);
        };
        if (this.game.DEBUG_MODE) {
            this.container.querySelector("#bb-puzzle-save").style.display = "block";
            this.container.querySelector("#bb-puzzle-m-save").style.display = "block";
            this.container.querySelector("#bb-puzzle-star").style.display = "block";
        }
        this.container.querySelector("#bb-puzzle-m-save").onclick = () => {
            let blackboardPuzzleData = BlackBoardPuzzle.SaveAsBlackBoardPuzzleData(this.game.machine, this._lastData.solutionLines, this._lastData.solutionBallTrajectories);
            Nabu.download("bb-puzzle-" + this.game.machine.name + ".json", JSON.stringify(blackboardPuzzleData));
        };
        this.container.querySelector("#bb-puzzle-save").onclick = () => {
            let blackboardPuzzleData = BlackBoardPuzzle.SaveAsBlackBoardPuzzleData(this.game.machine);
            Nabu.download("bb-puzzle-" + this.game.machine.name + ".json", JSON.stringify(blackboardPuzzleData));
        };
        this.container.querySelector("#bb-puzzle-star").onpointerup = (e) => {
            e.stopPropagation();
            this.dev_AddStar = !this.dev_AddStar;
            if (this.dev_AddStar) {
                this.container.querySelector("#bb-puzzle-star").classList.add("hinted");
            }
            else {
                this.container.querySelector("#bb-puzzle-star").classList.remove("hinted");
            }
        };
        this.victoryPanel = document.querySelector("#bb-puzzle-victory");
        this.victoryPanel.querySelector(".replay").onclick = () => {
            this.stop();
            this.unwin();
            this.resetTutorial();
        };
        this.victoryPanel.querySelector(".next").onclick = () => {
            if (this.isBonusLevel) {
                location.href = "#bb-puzzles";
            }
            else {
                location.href = "#bb-puzzle-" + (this.index + 1).toFixed(0);
            }
        };
        this.progressPanel = new BBPuzzleProgress(this);
        this.progressPanel.initialize();
        this.materialValue = this.victoryPanel.querySelector(".material .value");
        this.materialMedal = this.victoryPanel.querySelector(".material .medal");
        this.starsLine = this.victoryPanel.querySelector(".collected-stars");
        this.starsValue = this.victoryPanel.querySelector(".collected-stars .value");
        this.starsMedal = this.victoryPanel.querySelector(".collected-stars .medal");
        this.scoreStars = [...this.victoryPanel.querySelectorAll(".score img.star")];
        this.completionText = this.victoryPanel.querySelector(".text");
        this.toolboxPath = document.querySelector("#bb-puzzle-toolbox-path");
        this.toolboxPath.onclick = () => {
            if (this.drawMode === BBDrawMode.Path) {
                //this.drawMode = BBDrawMode.None;
            }
            else {
                this.drawMode = BBDrawMode.Path;
            }
            this.updateToolbox();
        };
        this.toolboxBouncer = document.querySelector("#bb-puzzle-toolbox-bouncer");
        this.toolboxBouncer.onclick = () => {
            if (this.drawMode === BBDrawMode.Bouncer) {
                //this.drawMode = BBDrawMode.None;
            }
            else {
                this.drawMode = BBDrawMode.Bouncer;
            }
            this.updateToolbox();
        };
        this.toolboxEraser = document.querySelector("#bb-puzzle-toolbox-eraser");
        this.toolboxEraser.onclick = () => {
            if (this.drawMode === BBDrawMode.Eraser) {
                //this.drawMode = BBDrawMode.None;
            }
            else {
                this.drawMode = BBDrawMode.Eraser;
            }
            this.updateToolbox();
        };
        this.materialCounter = new BBPuzzleMaterialCounter(this);
        //this.scoreBoard = new BBPuzzleScoreBoard(this);
        this.createSound = new BABYLON.Sound("marble-loop-sound", "./datas/sounds-bb/activate.wav", this.game.scene, undefined, { loop: false, autoplay: false, volume: 0.2 });
        this.starSound = new BABYLON.Sound("marble-loop-sound", "./datas/sounds-bb/collect_star.wav", this.game.scene, undefined, { loop: false, autoplay: false, volume: 0.2 });
    }
    static SaveAsBlackBoardPuzzleData(machine, solutionLines, solutionBallTrajectories) {
        let machineData = machine.serialize();
        let blackboard = machine.parts.find(part => {
            return part instanceof Core.BlackBoard;
        });
        if (!solutionLines) {
            solutionLines = [];
            if (blackboard instanceof Core.BlackBoard) {
                for (let i = 0; i < blackboard.lines.length; i++) {
                    let line = blackboard.lines[i];
                    let solutionLine = "";
                    for (let j = 0; j < line.points.length; j++) {
                        let pt = line.points[j];
                        let x = Math.floor((pt.x + 1) * 10000).toString(16).padStart(4, "0");
                        let y = Math.floor((pt.y + 1) * 10000).toString(16).padStart(4, "0");
                        let z = Math.floor((pt.z + 1) * 10000).toString(16).padStart(4, "0");
                        solutionLine = solutionLine + x + y + z;
                    }
                    solutionLines.push(solutionLine);
                }
                for (let i = 0; i < blackboard.bumpers.length; i++) {
                    let bouncer = blackboard.bumpers[i];
                    let solutionLine = "";
                    let x0 = Math.floor((bouncer.p0.x + 1) * 10000).toString(16).padStart(4, "0");
                    let y0 = Math.floor((bouncer.p0.y + 1) * 10000).toString(16).padStart(4, "0");
                    let z0 = Math.floor((bouncer.p0.z + 1) * 10000).toString(16).padStart(4, "0");
                    solutionLine = solutionLine + x0 + y0 + z0;
                    let x1 = Math.floor((bouncer.p1.x + 1) * 10000).toString(16).padStart(4, "0");
                    let y1 = Math.floor((bouncer.p1.y + 1) * 10000).toString(16).padStart(4, "0");
                    let z1 = Math.floor((bouncer.p1.z + 1) * 10000).toString(16).padStart(4, "0");
                    solutionLine = solutionLine + x1 + y1 + z1;
                    solutionLines.push(solutionLine);
                }
            }
        }
        if (!solutionBallTrajectories) {
            solutionBallTrajectories = [];
            for (let i = 0; i < machine.balls.length; i++) {
                let ball = machine.balls[i];
                if (ball.saveTrajectory && ball.lastTrajectory.length > 2) {
                    let solutionBallTrajectory = "";
                    for (let j = 0; j < ball.lastTrajectory.length; j++) {
                        let pt = ball.lastTrajectory[j];
                        let x = Math.floor((pt.x + 1) * 10000).toString(16).padStart(4, "0");
                        let y = Math.floor((pt.y + 1) * 10000).toString(16).padStart(4, "0");
                        let z = Math.floor((pt.z + 1) * 10000).toString(16).padStart(4, "0");
                        solutionBallTrajectory = solutionBallTrajectory + x + y + z;
                    }
                    solutionBallTrajectories.push(solutionBallTrajectory);
                }
            }
        }
        return {
            machine: machineData,
            solutionBallTrajectories: solutionBallTrajectories,
            solutionLines: solutionLines,
            targetMaterial: 20,
            targetAirTime: 1,
            targetMaxSpeed: 1
        };
    }
    static DEBUG_ShowSolution(machine, data) {
        for (let i = 0; i < data.solutionBallTrajectories.length; i++) {
            let solutionLineDataString = data.solutionBallTrajectories[i];
            let n = Math.floor(solutionLineDataString.length / 4 / 3);
            let points = [];
            for (let j = 0; j < n; j++) {
                let x = parseInt(solutionLineDataString.substring(j * 12 + 0, j * 12 + 4), 16) / 10000 - 1;
                let y = parseInt(solutionLineDataString.substring(j * 12 + 4, j * 12 + 8), 16) / 10000 - 1;
                let z = parseInt(solutionLineDataString.substring(j * 12 + 8, j * 12 + 12), 16) / 10000 - 1;
                let pt = new BABYLON.Vector3(x, y, z);
                points.push(pt);
            }
            BABYLON.MeshBuilder.CreateLines("test", { points: points, colors: points.map(p => { return new BABYLON.Color4(1, 1, 0); }) });
        }
    }
    static DEBUG_ApplySolution(machine, data) {
        let blackboard = machine.parts.find(part => {
            return part instanceof Core.BlackBoard;
        });
        if (blackboard instanceof Core.BlackBoard) {
            for (let i = 0; i < data.solutionLines.length; i++) {
                let solutionLineDataString = data.solutionLines[i];
                let n = Math.floor(solutionLineDataString.length / 4 / 3);
                let points = [];
                for (let j = 0; j < n; j++) {
                    let x = parseInt(solutionLineDataString.substring(j * 12 + 0, j * 12 + 4), 16) / 10000 - 1;
                    let y = parseInt(solutionLineDataString.substring(j * 12 + 4, j * 12 + 8), 16) / 10000 - 1;
                    let z = parseInt(solutionLineDataString.substring(j * 12 + 8, j * 12 + 12), 16) / 10000 - 1;
                    let pt = new BABYLON.Vector3(x, y, z);
                    points.push(pt);
                }
                blackboard.addLine(points);
            }
            blackboard.regenerateTemplate();
            blackboard.instantiate(true);
        }
    }
    updateToolbox() {
        this.toolboxPath.classList.remove("selected");
        this.toolboxBouncer.classList.remove("selected");
        this.toolboxEraser.classList.remove("selected");
        if (this.drawMode === BBDrawMode.Path) {
            this.toolboxPath.classList.add("selected");
        }
        if (this.drawMode === BBDrawMode.Bouncer) {
            this.toolboxBouncer.classList.add("selected");
        }
        if (this.drawMode === BBDrawMode.Eraser) {
            this.toolboxEraser.classList.add("selected");
        }
    }
    setHoveredElement(e) {
        if (e != this.hoveredElement) {
            if (this.hoveredElement) {
                this.hoveredElement.hovered = false;
                this.hoveredElement.updateHighlight();
            }
            this.hoveredElement = e;
            if (this.hoveredElement) {
                this.hoveredElement.hovered = true;
                this.hoveredElement.updateHighlight();
            }
        }
    }
    setSelectedElement(e) {
        if (e != this.selectedElement) {
            if (this.selectedElement) {
                this.selectedElement.selected = false;
                this.selectedElement.updateHighlight();
            }
            this.selectedElement = e;
            if (this.selectedElement) {
                this.selectedElement.selected = true;
                this.selectedElement.updateHighlight();
            }
        }
    }
    getCurrentBBElementCount() {
        if (this.blackboard) {
            return this.blackboard.lines.length + this.blackboard.bumpers.length;
        }
        return 0;
    }
    async showPop(duration = 1) {
    }
    initialize(data) {
        this._lastData = data;
        this.dispose();
        this.game.room.skybox.rotation.y = this.index;
        this.initializeStickers();
        this.playButton.classList.remove("disabled");
        this.playButton.classList.remove("hinted");
        this.container.style.display = "block";
        this.completed = false;
        this.failed = false;
        this.undoButton.classList.remove("hinted");
        this.targetMaterial = 20;
        this.targetAirTime = 1;
        this.targetMaxSpeed = 1;
        if (isFinite(data.targetMaterial)) {
            this.targetMaterial = Math.ceil(data.targetMaterial * 1.5 / 10) * 10;
        }
        if (isFinite(data.targetMaxSpeed)) {
            this.targetMaxSpeed = data.targetMaxSpeed;
        }
        if (isFinite(data.targetAirTime)) {
            this.targetAirTime = data.targetAirTime;
        }
        this.unwin();
        this.drawBlackboardPath = [];
        this.drawBlackboardCurrentPointer = undefined;
        if (this.drawBlackboardMesh) {
            this.drawBlackboardMesh.dispose();
            this.drawBlackboardMesh = undefined;
        }
        while (this.hints.length > 0) {
            this.hints.pop().dispose();
        }
        this.blackboard = this.game.machine.parts.find(part => { return part instanceof Core.BlackBoard; });
        if (!this.blackboard) {
            this.dispose();
            return;
        }
        if (this.playStopButton3D) {
            this.playStopButton3D.position.x = (this.blackboard.w - 1) * 0.5 * Core.tileSize;
            this.playStopButton3D.position.y = -0.02;
            this.playStopButton3D.position.z = -1.5 * Core.tileSize - 0.03;
            this.playStopButton3D.rotation.x = -Math.PI / 3;
        }
        this.game.machine.balls.forEach(ball => {
            ball.onMarbleChocSoundPlay = (v) => {
                this.game.toonSoundManager.start({
                    text: "TAC !",
                    pos: ball.position.clone(),
                    color: "#FFFFFF",
                    size: 0.008 + v * 0.005,
                    duration: 0.3,
                    type: ToonSoundType.Poc
                });
            };
            ball.onRailBumpSoundPlay = (v) => {
                this.game.toonSoundManager.start({
                    text: "TOC",
                    pos: ball.position.clone(),
                    color: "#FFFFFF",
                    size: 0.008 + v * 0.005,
                    duration: 0.3,
                    type: ToonSoundType.Poc
                });
            };
            ball.onBumperBounceSoundPlay = (v) => {
                this.game.toonSoundManager.start({
                    text: "TING !",
                    pos: ball.position.clone(),
                    color: "#FFFFFF",
                    size: 0.008 + v * 0.005,
                    duration: 0.3,
                    type: ToonSoundType.Poc
                });
            };
        });
        this.game.machine.parts.filter(part => { return part instanceof Core.LargeBitSplit; }).forEach(largeSplit => {
            if (largeSplit instanceof Core.LargeBitSplit) {
                largeSplit.onClic = () => {
                    let p = largeSplit.position.clone();
                    p.x += 0.017;
                    p.y += 0.025;
                    this.game.toonSoundManager.start({
                        text: "* CLICK *",
                        pos: p,
                        color: "#bacfdb",
                        size: 0.013,
                        duration: 0.4,
                        type: ToonSoundType.Poc
                    });
                };
            }
        });
        this.winzones = [];
        let ballIndexToNumero = new Map();
        let arrivals = this.game.machine.parts.filter(part => { return part.partName === "endbasket"; });
        arrivals.forEach(arrival => {
            if (arrival) {
                let ballIndex = this.game.materials.baseMaterialIndexToBallMaterialIndex(arrival.getColor(0));
                let numero = ballIndexToNumero.get(ballIndex);
                if (!isFinite(numero)) {
                    numero = ballIndexToNumero.size;
                    ballIndexToNumero.set(ballIndex, numero);
                }
                let p = arrival.position;
                let winZoneMin = p.clone();
                winZoneMin.x -= 2 * Core.tileSize * 0.5;
                winZoneMin.z -= 2 * Core.tileSize * 0.5;
                let winZoneMax = p.clone();
                winZoneMax.x += 2 * Core.tileSize * 0.5;
                winZoneMax.y += Core.tileHeight;
                winZoneMax.z += 2 * Core.tileSize * 0.5;
                /*
                let box = BABYLON.MeshBuilder.CreateBox(
                    "debug-box",
                    {
                        width: winZoneMax.x - winZoneMin.x,
                        height: winZoneMax.y - winZoneMin.y,
                        depth: winZoneMax.z - winZoneMin.z,
                    }
                )
                box.position.copyFrom(winZoneMin).addInPlace(winZoneMax).scaleInPlace(0.5);
                */
                if (arrival instanceof Core.EndBasket) {
                    let stickerSource = this.stickers[numero % this.stickers.length];
                    if (stickerSource) {
                        let sticker = new BABYLON.InstancedMesh("sticker", stickerSource);
                        sticker.parent = arrival;
                        sticker.position.copyFrom(arrival.flagPole.position);
                        sticker.position.x += 0.0135;
                        sticker.position.y += 0.052;
                        sticker.position.z -= 0.001;
                    }
                }
                let winZone = new ChallengeWinZone(winZoneMin, winZoneMax, ballIndex);
                this.winzones.push(winZone);
                numero++;
            }
        });
        this.stars = this.game.machine.parts.filter(part => { return part instanceof Core.Star; });
        this.game.machine.balls.forEach(ball => {
            let numero = ballIndexToNumero.get(ball.materialIndex);
            /*
            let sticker = new BABYLON.InstancedMesh("sticker", this.stickers[numero]);
            //sticker.position.copyFrom(ball.position);
            //sticker.position.y += Core.tileHeight;
            //sticker.position.z += 0.033;
            sticker.position.copyFrom(ball.position);
            sticker.scaling.copyFromFloats(0.9, 0.9, 0.9);
            sticker.position.z = - ball.radius - 0.0015;

            this.ballStickersInstances.push(sticker);
            */
            let stickerShell = new BABYLON.Mesh("sticker-" + Math.random().toFixed(6));
            let data = BABYLON.CreateSphereVertexData({ diameter: ball.size, segments: 14 });
            let uvs = data.uvs;
            for (let i = 0; i < uvs.length / 2; i++) {
                uvs[2 * i] *= 2;
            }
            data.applyToMesh(stickerShell);
            stickerShell.parent = ball;
            stickerShell.rotation.z = Math.PI;
            stickerShell.scaling.copyFromFloats(1.2, 1.2, 1.2);
            let fallbackNumero = isFinite(numero) ? numero : 0;
            let stickerSource = this.stickers[fallbackNumero % this.stickers.length];
            if (stickerSource) {
                stickerShell.material = stickerSource.material;
            }
        });
        this.solutionLines = [];
        if (data.solutionLines.length > 0) {
            for (let i = 0; i < data.solutionLines.length; i++) {
                let solutionLineDataString = data.solutionLines[i];
                let n = Math.floor(solutionLineDataString.length / 4 / 3);
                let points = [];
                for (let j = 0; j < n; j++) {
                    let x = parseInt(solutionLineDataString.substring(j * 12 + 0, j * 12 + 4), 16) / 10000 - 1;
                    let y = parseInt(solutionLineDataString.substring(j * 12 + 4, j * 12 + 8), 16) / 10000 - 1;
                    let z = parseInt(solutionLineDataString.substring(j * 12 + 8, j * 12 + 12), 16) / 10000 - 1;
                    let pt = new BABYLON.Vector3(x, y, z);
                    points.push(pt);
                }
                if (points.length >= 2) {
                    this.solutionLines.push(points);
                    this.hints.push(new BlackBoardPuzzleHint(this, points));
                }
            }
        }
        if (this.index >= 1000) {
            this.toolboxPath.style.display = "none";
            this.toolboxBouncer.style.display = "";
        }
        else {
            this.toolboxPath.style.display = "";
            this.toolboxBouncer.style.display = "none";
        }
        this.progressPanel.initialize();
        this.materialCounter.initialize();
        this.toolboxPath.parentElement.style.display = "none";
        if (this.index >= 4) {
            this.toolboxPath.parentElement.style.display = "";
        }
        this.toolboxPath.classList.remove("disabled");
        this.toolboxBouncer.classList.remove("disabled");
        this.toolboxEraser.classList.remove("disabled");
        this.materialCounter.container.style.display = "";
        this.undoButton.style.display = "";
        if (this.index === 1 && !this.isBonusLevel) {
            this.linesCountLimit = 1;
            this.toolboxBouncer.classList.add("disabled");
            this.toolboxEraser.classList.add("disabled");
            this.drawMode = BBDrawMode.Path;
            this.materialCounter.container.style.display = "none";
        }
        else if (this.index === 2 && !this.isBonusLevel) {
            this.linesCountLimit = 2;
            this.drawMode = BBDrawMode.Path;
            this.materialCounter.container.style.display = "none";
        }
        else {
            if (this.index >= 1000) {
                this.drawMode = BBDrawMode.Bouncer;
            }
            else {
                this.drawMode = BBDrawMode.Path;
            }
            this.linesCountLimit = this.solutionLines.length + Math.min((this.index - 1), 6);
            this.linesCountLimit = Math.max(this.linesCountLimit, 1);
            if (this.isBonusLevel) {
                this.linesCountLimit = 6;
            }
        }
        this.updateToolbox();
        BBPuzzleAnimator.AnimateShow(this.game.machine).then(() => {
            if (this.index === 1 && !this.isBonusLevel) {
                let tutorialGenerator = BBPuzzleTutorialsList[IndexToBBPuzzleLevel(this.index, this.isBonusLevel)];
                if (tutorialGenerator) {
                    this.tutorial = tutorialGenerator(this);
                }
                this.helpButton.classList.add("disabled");
                this.skipButton.classList.add("disabled");
                setTimeout(() => {
                    if (this.tutorial && !this.tutorial.aborted) {
                        this.tutorial.runTutorial();
                    }
                }, 1000);
            }
            else {
                let tutorialGenerator = BBPuzzleTutorialsList[IndexToBBPuzzleLevel(this.index, this.isBonusLevel)];
                if (tutorialGenerator) {
                    this.tutorial = tutorialGenerator(this);
                }
                else {
                    delete this.tutorial;
                }
                if (this.tutorial) {
                    setTimeout(() => {
                        if (this.tutorial && !this.tutorial.aborted) {
                            this.tutorial.runTutorial();
                        }
                    }, 1000);
                }
                else {
                    this.onWin = () => {
                        this.win();
                    };
                    this.onFail = () => {
                        this.undoButton.classList.add("hinted");
                    };
                }
                this.hintsActivated = false;
                if (this.solutionLines.length > 0) {
                    this.helpButton.classList.remove("disabled");
                }
                else {
                    this.helpButton.classList.add("disabled");
                }
                this.skipButton.classList.remove("disabled");
            }
            document.body.addEventListener("pointerdown", this._pointerDown);
            document.body.addEventListener("pointermove", this._pointerMove);
            document.body.addEventListener("pointerup", this._pointerUp);
            this._savedStates = [
                {
                    lines: [],
                    bumpers: []
                }
            ];
            this._currentStateIndex = 0;
            this.bbPuzzlePet.initialize();
            this.initialized = true;
        });
    }
    updateTitle() {
        this.titleStarsElement.innerHTML = "";
        let score = this.game.bbPuzzleLoader.getScore(IndexToBBPuzzleLevel(this.index, this.isBonusLevel));
        if (score) {
            for (let n = 0; n < score.stars; n++) {
                this.titleStarsElement.innerHTML += "<div class='title-collected-star'></div>";
            }
        }
        this.titleLevelElement.innerHTML = "第 " + (this.index % 1000).toFixed(0) + " 關";
        this.titleNameElement.innerHTML = BBPuzzlesMenu.FileNameToDisplayName(IndexToBBPuzzleLevel(this.index, this.isBonusLevel).replace("bb-puzzle-", ""));
    }
    dispose() {
        if (this.tutorial) {
            this.tutorial.abort();
        }
        this.container.style.display = "none";
        this.victoryPanel.style.display = "none";
        this.bottomButtonsContainer.style.display = "";
        //this.progressPanel.container.style.transform = "translateY(-500px)";
        document.body.removeEventListener("pointerdown", this._pointerDown);
        document.body.removeEventListener("pointermove", this._pointerMove);
        document.body.removeEventListener("pointerup", this._pointerUp);
        if (this.undoneGhost) {
            this.undoneGhost.dispose();
        }
        while (this.ballTrajectoryMeshes.length > 0) {
            this.ballTrajectoryMeshes.pop().dispose();
        }
        while (this.ballStickersInstances.length > 0) {
            this.ballStickersInstances.pop().dispose();
        }
        this.initialized = false;
    }
    async runAllHints(force) {
        if (this._hintsRunning) {
            return;
        }
        this._hintsRunning = true;
        for (let i = 0; i < this.hints.length; i++) {
            let hint = this.hints[i];
            if (force || this.hintsActivated && !this.game.machine.playing) {
                await hint.run();
            }
        }
        this._hintsRunning = false;
        if (this.hintsActivated && !this.game.machine.playing) {
            setTimeout(() => {
                if (this.hintsActivated && !this.game.machine.playing) {
                    this.runAllHints();
                }
            }, 2000);
        }
    }
    showHints() {
        for (let i = 0; i < this.hints.length; i++) {
            let hint = this.hints[i];
            hint.setIsVisible(true);
        }
    }
    hideHints() {
        for (let i = 0; i < this.hints.length; i++) {
            let hint = this.hints[i];
            hint.setIsVisible(false);
        }
    }
    initializeStickers() {
        while (this.stickers.length > 0) {
            this.stickers.pop().dispose(false, true);
        }
        this.stickers = [];
        for (let n = 0; n < 4; n++) {
            let numero = n + 1;
            let material = new BABYLON.StandardMaterial("sticker");
            material.specularColor.copyFromFloats(0, 0, 0);
            let texture = new BABYLON.DynamicTexture("tex", 256, undefined, true);
            texture.hasAlpha = true;
            let context = texture.getContext();
            context.clearRect(0, 0, 256, 256);
            // test
            //context.fillStyle = "#ffffff";
            //context.fillRect(0, 0, 256, 256);
            // test
            context.strokeStyle = "#000000";
            context.fillStyle = "#ffffff";
            context.font = "90px BigBottomCartoon";
            context.lineWidth = 16;
            context.strokeText(numero.toFixed(0), 32 + 64, 119 + 64);
            context.fillText(numero.toFixed(0), 32 + 64, 119 + 64);
            texture.update();
            material.diffuseTexture = texture;
            material.emissiveColor.copyFromFloats(1, 1, 1);
            material.useAlphaFromDiffuseTexture = false;
            let sticker = BABYLON.MeshBuilder.CreatePlane("sticker-" + numero.toFixed(0), { size: 0.024 });
            sticker.material = material;
            this.stickers.push(sticker);
        }
    }
    start() {
    }
    reset() {
        this.stop();
        if (this.undoneGhost) {
            this.undoneGhost.dispose();
        }
        while (this.ballTrajectoryMeshes.length > 0) {
            this.ballTrajectoryMeshes.pop().dispose();
        }
        while (this.blackboard.lines.length > 0) {
            this.blackboard.removeLastLine();
        }
        this.blackboard.regenerateTemplate();
        this.blackboard.instantiate(true);
    }
    async setValue(v, v0, span, duration, toString, onUpdate) {
        return new Promise(resolve => {
            let dv = v - v0;
            let t0 = performance.now() / 1000;
            let step = () => {
                let t = performance.now() / 1000;
                let dt = t - t0;
                if (dt < duration) {
                    let f = dt / duration;
                    if (onUpdate) {
                        onUpdate(f);
                    }
                    f = Nabu.Easing.easeOutCubic(f);
                    span.innerHTML = toString(v0 + f * dv);
                    requestAnimationFrame(step);
                }
                else {
                    if (onUpdate) {
                        onUpdate(1);
                    }
                    span.innerHTML = toString(v);
                    resolve();
                }
            };
            step();
        });
    }
    async setMedal(v, span, duration) {
        return new Promise(resolve => {
            let t0 = performance.now() / 1000;
            span.innerHTML = v.toFixed(0);
            if (v === 1) {
                span.classList.add("gold");
            }
            else if (v === 2) {
                span.classList.add("silver");
            }
            else if (v === 3) {
                span.classList.add("bronze");
            }
            let step = () => {
                let t = performance.now() / 1000;
                let dt = t - t0;
                if (dt < duration) {
                    requestAnimationFrame(step);
                }
                else {
                    resolve();
                }
            };
            step();
        });
    }
    _getMaterialScore() {
        let material = this.getUsedMaterial();
        let materialScore = (2 - material / this.targetMaterial) * 1000;
        if (materialScore > 0) {
            return materialScore;
        }
        return 0;
    }
    static GetStarsCount(score) {
        if (score >= 1000) {
            return 3;
        }
        if (score >= 500) {
            return 2;
        }
        if (score >= 100) {
            return 1;
        }
        return 0;
    }
    getMaterialStarsCount(usedMaterial) {
        let f = usedMaterial / this.targetMaterial;
        if (this.stars.length === 0) {
            if (f <= 1) {
                return 3;
            }
            if (f <= 1.5) {
                return 2;
            }
            if (f <= 2) {
                return 1;
            }
        }
        else if (this.stars.length === 1) {
            if (f <= 1) {
                return 2;
            }
            if (f <= 1.75) {
                return 1;
            }
        }
        else if (this.stars.length === 2) {
            if (f <= 1) {
                return 1;
            }
        }
        return 0;
    }
    getUsedMaterial() {
        let usedMaterial = 0;
        this.blackboard.bumpers.forEach(b => {
            usedMaterial += 2 * BABYLON.Vector3.Distance(b.p0, b.p1);
        });
        this.blackboard.lines.forEach(l => {
            usedMaterial += Mummu.GetPathLength(l.points);
        });
        if (this.drawBlackboardPath && this.drawBlackboardPath.length >= 2) {
            if (this.drawMode === BBDrawMode.Path) {
                usedMaterial += Mummu.GetPathLength(this.drawBlackboardPath);
            }
            else if (this.drawMode === BBDrawMode.Bouncer) {
                usedMaterial += Mummu.GetPathLength(this.drawBlackboardPath);
            }
        }
        usedMaterial *= 100;
        return usedMaterial;
    }
    getMedalNeedLow(value, target) {
        if (value <= target) {
            return 1;
        }
        else if (value < 1.5 * target) {
            return 2;
        }
        return 3;
    }
    getMedalNeedHigh(value, target) {
        if (value >= target) {
            return 1;
        }
        else if (value >= target / 2) {
            return 2;
        }
        return 3;
    }
    async win() {
        if (this.completed) {
            return;
        }
        this.completed = true;
        let material = this.getUsedMaterial();
        let materialStarsCount = this.getMaterialStarsCount(material);
        let collectedStarsCount = this.stars.filter(s => { return s.collected; }).length;
        let totalStars = materialStarsCount + collectedStarsCount;
        let currentScore = this.game.bbPuzzleLoader.getScore(IndexToBBPuzzleLevel(this.index, this.isBonusLevel));
        let isBest = true;
        if (currentScore) {
            if (currentScore.stars > totalStars) {
                isBest = false;
            }
            if (currentScore.stars === totalStars && currentScore.material < material) {
                isBest = false;
            }
        }
        if (isBest) {
            this.game.bbPuzzleLoader.setScore({ puzzleName: IndexToBBPuzzleLevel(this.index, this.isBonusLevel), stars: materialStarsCount + collectedStarsCount, material: material });
        }
        this.victoryPanel.style.display = "flex";
        this.bottomButtonsContainer.style.display = "none";
        this.completionText.innerHTML = "...";
        this.materialValue.innerHTML = "&nbsp;";
        this.materialMedal.classList.remove("gold", "silver", "bronze");
        this.materialMedal.innerHTML = "&nbsp;";
        if (this.stars.length > 0) {
            this.starsLine.style.display = "block";
        }
        else {
            this.starsLine.style.display = "none";
        }
        this.starsValue.innerHTML = "0 / " + this.stars.length.toFixed(0);
        this.starsMedal.classList.remove("gold", "silver", "bronze");
        this.starsMedal.innerHTML = "&nbsp;";
        this.scoreStars.forEach(scoreStar => {
            scoreStar.classList.remove("active");
            scoreStar.classList.add("inactive");
            scoreStar.style.transform = "";
            scoreStar.style.filter = "";
            scoreStar.style.opacity = "";
        });
        let count = this.stars.length > 0 ? 2 : 1;
        let d = 1 * (3 - this.stars.length);
        //this.progressPanel.container.style.transform = "translateY(-2px)";
        await this.setValue(material, 0, this.materialValue, d, v => { return v.toFixed(1); }, (f) => {
            let n = this.getMaterialStarsCount((1 - f) * 2.5 * this.targetMaterial + f * material);
            this._updateVictoryStars(n);
        });
        if (!this.completed) {
            return;
        }
        //await this.setMedal(this.getMedalNeedLow(material, this.targetMaterial), this.materialMedal, 0.8);
        //if (!this.completed) { return; }
        if (collectedStarsCount > 0) {
            await this.setValue(collectedStarsCount, 0, this.starsValue, 1 * this.stars.length, v => { return v.toFixed(0) + " / " + this.stars.length.toFixed(0); }, (f) => {
                this._updateVictoryStars(Math.round(f * collectedStarsCount) + materialStarsCount);
            });
            if (!this.completed) {
                return;
            }
            //await this.setMedal(this.getMedalNeedHigh(collectedStarsCount, this.stars.length), this.starsMedal, 0.8);
            //if (!this.completed) { return; }
        }
        if (totalStars === 0) {
            this.completionText.innerHTML = "成功 :)";
        }
        else if (totalStars === 1) {
            this.completionText.innerHTML = "表現不錯 :)";
        }
        else if (totalStars === 2) {
            this.completionText.innerHTML = "玩得漂亮！:)";
        }
        else if (totalStars === 3) {
            this.completionText.innerHTML = "完美！:)";
        }
        this.progressPanel.updateTotalStars();
        for (let n = totalStars; n < 3; n++) {
            BBPuzzleAnimator.DepopStar(this.scoreStars[n], 1);
        }
    }
    unwin() {
        this.victoryPanel.style.display = "none";
        this.bottomButtonsContainer.style.display = "";
        this.updateTitle();
        this.progressPanel.initialize();
        //this.progressPanel.container.style.transform = "translateY(-500px)";
        this.completed = false;
        this._successTimer = 0;
        this._failureTimer = 0;
    }
    resetTutorial() {
        if (this.tutorial) {
            this.tutorial.abort();
            requestAnimationFrame(() => {
                this.tutorial.runTutorial();
            });
        }
    }
    isInWinzone(ball) {
        for (let i = 0; i < this.winzones.length; i++) {
            let winzone = this.winzones[i];
            if (winzone.materialIndex === -1 || winzone.materialIndex === ball.materialIndex) {
                if (Mummu.SphereAABBCheck(ball.position, ball.radius, winzone.min, winzone.max)) {
                    return true;
                }
            }
        }
        return false;
    }
    update(rawtDT) {
        if (!this.initialized) {
            return;
        }
        if (this.debugMark) {
            if (this.collidedPoint) {
                this.debugMark.isVisible = false;
                this.debugMark.position.copyFrom(this.collidedPoint);
            }
            else {
                this.debugMark.isVisible = false;
            }
        }
        if (!this.game.machine.playing) {
            if (this.targetedPoint && !this.draggedBouncer) {
                if (!this.collidedPoint) {
                    this.collidedPoint = this.targetedPoint;
                }
                else {
                    this.collidedPoint.scaleInPlace(0.7).addInPlace(this.targetedPoint.scale(0.3));
                }
                this.collidedPoint = this.forcePointNotColliding(this.collidedPoint);
                let invMatrix = this.blackboard.getWorldMatrix().clone().invert();
                let localPosition = BABYLON.Vector3.TransformCoordinates(this.collidedPoint, invMatrix);
                let localTargetedPoint = BABYLON.Vector3.TransformCoordinates(this.targetedPoint, invMatrix);
                //localPosition = this.blackboard.clampPointOnBoard(localPosition, 0.005);
                localPosition = this.blackboard.clampLocalPositionOnBBox(localPosition, 0.005);
                for (let i = 1; i < this.drawBlackboardPath.length; i++) {
                    let distSquared = BABYLON.Vector3.DistanceSquared(this.drawBlackboardPath[i], localPosition);
                    if (distSquared < 0.012 * 0.012) {
                        this.drawBlackboardPath = this.drawBlackboardPath.slice(0, i + 1);
                        this.materialCounter.update();
                    }
                }
                let last = this.drawBlackboardPath[this.drawBlackboardPath.length - 1];
                let pointOnBoard = this.blackboard.isPointOnBoard(localPosition);
                let squareDist = undefined;
                if (last) {
                    squareDist = BABYLON.Vector3.DistanceSquared(last, localPosition);
                    //Mummu.DrawDebugPoint(last, 3, BABYLON.Color3.Red(), 0.01);
                }
                //Mummu.DrawDebugPoint(localPosition, 3, BABYLON.Color3.Green(), 0.01);
                if (!last || squareDist > 0.002 * 0.002 && squareDist < Core.tileSize * Core.tileSize) {
                    if (pointOnBoard) {
                        this.drawBlackboardPath.push(localPosition);
                        this.materialCounter.update();
                    }
                    this.drawBlackboardCurrentPointer = undefined;
                }
                else if (last && BABYLON.Vector3.DistanceSquared(localTargetedPoint, last) > Core.tileSize * Core.tileSize) {
                    this.doDrawPathOnBlackboard();
                }
                else {
                    this.drawBlackboardCurrentPointer = localPosition;
                }
            }
            else {
                delete this.collidedPoint;
            }
        }
        let ballsIn = true;
        let failing = this.game.machine.playing && !this.completed;
        for (let i = 0; i < this.game.machine.balls.length; i++) {
            let ball = this.game.machine.balls[i];
            let inWinZone = this.isInWinzone(ball);
            if (inWinZone && !this.ballsWinState[i]) {
                this.ballsWinState[i] = true;
                //this.score += 100;
                /*
                this.game.toonSoundManager.start({
                    text: "+ 100",
                    pos: ball.position.clone(),
                    color: "#ffdd00",
                    size: 0.02,
                    duration: 1,
                    type: ToonSoundType.Poc
                });
                */
            }
            ballsIn = ballsIn && ball && inWinZone;
            if (failing && ball.visibleVelocity && ball.visibleVelocity.length() > 0.005) {
                failing = false;
            }
            for (let i = 0; i < this.stars.length; i++) {
                if (!this.stars[i].collected) {
                    let sqrDist = BABYLON.Vector3.DistanceSquared(ball.position, this.stars[i].position);
                    if (sqrDist < (ball.radius + 0.35 * Core.tileSize) * (ball.radius + 0.35 * Core.tileSize)) {
                        this.stars[i].collect();
                        this.game.toonSoundManager.start({
                            text: "TING !",
                            pos: ball.position.clone(),
                            color: "#ffdd00",
                            size: 0.02,
                            duration: 1,
                            type: ToonSoundType.Poc
                        });
                        this.starSound.play();
                    }
                }
            }
        }
        if (ballsIn) {
            this._successTimer += rawtDT;
        }
        else {
            this._successTimer = 0;
        }
        if (failing) {
            this._failureTimer += rawtDT;
        }
        else {
            this._failureTimer = 0;
        }
        if (this._successTimer > 1.5) {
            if (this.tutorial) {
                this.tutorial.playState = 1;
            }
            this.onWin();
        }
        else if (this._failureTimer > 1.5) {
            if (!this.failed) {
                this.failed = true;
                if (this.tutorial) {
                    this.tutorial.playState = 2;
                }
                this.onFail();
            }
        }
        else {
            //this.completionText.innerHTML = "NOT COMPLETED";
        }
        if (this.index === 1) {
            if (this.getCurrentBBElementCount() === 0) {
                this.playButton.classList.add("disabled");
                this.playButton.classList.remove("hinted");
            }
            else {
                this.playButton.classList.remove("disabled");
                if (!this.failed) {
                    this.playButton.classList.add("hinted");
                }
            }
        }
        if (this.blackboard && this.getCurrentBBElementCount() === 0 && this.game.machine.stopped) {
            this.undoButton.classList.add("disabled");
        }
        else {
            this.undoButton.classList.remove("disabled");
        }
        if (this.drawBlackboardPath.length > 0 && !this.completed) {
            if (!this.drawBlackboardMesh) {
                this.drawBlackboardMesh = new BABYLON.Mesh("draw-blackboard-mesh");
                this.drawBlackboardMesh.material = this.game.materials.selectorFullLitLightBlueMaterial;
            }
            this.drawBlackboardMesh.isVisible = true;
            this.drawBlackboardMesh.position.copyFrom(this.blackboard.position);
            let path = this.drawBlackboardPath;
            if (this.drawBlackboardCurrentPointer) {
                path = [...this.drawBlackboardPath.map(p => { return p.clone(); }), this.drawBlackboardCurrentPointer.clone()];
            }
            if (path.length >= 2) {
                if (this.drawMode === BBDrawMode.Path) {
                    Mummu.CreateTrailVertexData({ path: path, up: new BABYLON.Vector3(0, 0, -1), radius: 0.004 }).applyToMesh(this.drawBlackboardMesh, true);
                }
                else if (this.drawMode === BBDrawMode.Bouncer) {
                    Mummu.CreateTrailVertexData({ path: [path[0], path[path.length - 1]], up: new BABYLON.Vector3(0, 0, -1), radius: 0.004 }).applyToMesh(this.drawBlackboardMesh, true);
                }
            }
        }
        else {
            if (this.drawBlackboardMesh) {
                this.drawBlackboardMesh.isVisible = false;
            }
        }
        if (this.game.machine.playing) {
            this.playButton.style.display = "none";
            this.stopButton.style.display = "";
            if (this.playStopButton3D) {
                this.playStopButton3D.button.material = this.stopButton3DMaterial;
            }
            for (let n = 0; n < this.game.machine.balls.length; n++) {
                let ball = this.game.machine.balls[n];
                let prev = this.ballsPrevPosition[n];
                let delta = ball.position.subtract(prev);
                this.ballsPrevPosition[n].copyFrom(ball.position);
            }
        }
        else {
            this.playButton.style.display = "";
            this.stopButton.style.display = "none";
            if (this.playStopButton3D) {
                this.playStopButton3D.button.material = this.playButton3DMaterial;
            }
        }
        if (this.USE_PLAY_STOP_BUTTON_3D) {
            this.playButton.style.display = "none";
            this.stopButton.style.display = "none";
        }
    }
    _clearAction() {
        this.drawBlackboardPath = [];
        delete this.draggedBouncer;
        delete this.drawBlackboardCurrentPointer;
        delete this.targetedPoint;
        delete this.collidedPoint;
        this._pointerDownCount = 0;
        this.setSelectedElement(undefined);
    }
    async doDrawPathOnBlackboard() {
        if (this.drawBlackboardCurrentPointer) {
            this.drawBlackboardPath.push(this.drawBlackboardCurrentPointer.clone());
            //Mummu.DrawDebugPoint(this.drawBlackboardCurrentPointer.add(this.blackboard.position), 120, BABYLON.Color3.Green(), 0.05);
        }
        if (this.drawBlackboardPath.length > 2) {
            //Mummu.DrawDebugPoint(this.drawBlackboardPath[0].add(this.blackboard.position), 120, BABYLON.Color3.Blue(), 0.05);
            //let debugPath = BABYLON.MeshBuilder.CreateLines("debug-path", { points: this.drawBlackboardPath, colors: this.drawBlackboardPath.map(v => { return new BABYLON.Color4(1, 0, 0, 1); }) });
            //debugPath.position.copyFrom(this.blackboard.position);
            //debugPath.position.z = -0.03;
            //setTimeout(() => {
            //    debugPath.dispose()
            //}, 5000);
            if (this.drawMode === BBDrawMode.Path) {
                this.blackboard.addRawLine(this.drawBlackboardPath);
                this.createSound.play();
            }
            else if (this.drawMode === BBDrawMode.Trampoline) {
                //this.blackboard.addTrampoline(this.drawBlackboardPath[0].clone(), this.drawBlackboardPath[this.drawBlackboardPath.length - 1].clone());
            }
            else if (this.drawMode === BBDrawMode.Bouncer) {
                this.blackboard.addBouncer(this.drawBlackboardPath[0].clone(), this.drawBlackboardPath[this.drawBlackboardPath.length - 1].clone());
                this.createSound.play();
            }
            while (this.blackboard.bbElements.length > this.linesCountLimit) {
                this.blackboard.removeFirstElement();
            }
            this.blackboard.regenerateTemplate();
            this.blackboard.instantiate(true);
            this.saveCurrentState();
        }
        this._clearAction();
        if (this.game.bbPuzzle.undoneGhost) {
            this.game.bbPuzzle.undoneGhost.dispose();
        }
        this.materialCounter.update();
    }
    forcePointNotColliding(pt) {
        let clampedPt = pt.clone();
        let obstacles = this.game.machine.parts.filter(part => { return part instanceof Core.Box || part instanceof Core.Diamond || part instanceof Core.Bumper; });
        for (let i = 0; i < obstacles.length; i++) {
            let box = obstacles[i];
            let collider = box.colliders[0];
            if (collider) {
                let intersection = Mummu.SphereColliderIntersection(clampedPt, 0, collider.baseCollider);
                if (intersection && intersection.hit) {
                    clampedPt.addInPlace(intersection.normal.scale(intersection.depth));
                }
            }
        }
        let mechanisms = this.game.machine.parts.filter(part => { return part instanceof Core.EndBasket || part instanceof Core.LargeBitSplit; });
        for (let i = 0; i < mechanisms.length; i++) {
            let mechanism = mechanisms[i];
            let intersection = Mummu.SphereBoxIntersection(clampedPt, 0, {
                width: mechanism.localAABBMax.x - mechanism.localAABBMin.x,
                height: mechanism.localAABBMax.y - mechanism.localAABBMin.y,
                depth: mechanism.localAABBMax.z - mechanism.localAABBMin.z,
                worldMatrix: mechanism.getWorldMatrix()
            });
            if (intersection && intersection.hit) {
                clampedPt.addInPlace(intersection.normal.scale(intersection.depth));
            }
        }
        return clampedPt;
    }
    saveCurrentState() {
        let state = {
            lines: [],
            bumpers: []
        };
        this.blackboard.lines.forEach(line => {
            state.lines.push(line.points.map(pt => { return pt.clone(); }));
        });
        this.blackboard.bumpers.forEach(bumper => {
            state.bumpers.push({ p0: bumper.p0.clone(), p1: bumper.p1.clone() });
        });
        this._currentStateIndex++;
        while (this._savedStates.length > this._currentStateIndex) {
            this._savedStates.pop();
        }
        this._savedStates.push(state);
    }
}
class BlackBoardTrackGhost extends BABYLON.Mesh {
    constructor(name) {
        super(name);
        this.duration = 0.3;
        this._update = () => {
            if (this.isDisposed()) {
                this._scene.onBeforeRenderObservable.removeCallback(this._update);
                return;
            }
            let dt = (performance.now() - this._t0) / 1000;
            let f = dt / this.duration;
            f = 1 - Nabu.Easing.easeInSquare(f);
            this.visibility = f;
            if (this.visibility <= 0) {
                this.dispose();
            }
        };
        this._scene.onBeforeRenderObservable.add(this._update);
        this._t0 = performance.now();
    }
}
class BlackBoardPuzzleHint extends BABYLON.Mesh {
    constructor(puzzle, path) {
        super("bb-puzzle-hint");
        this.puzzle = puzzle;
        this.path = path;
        this.radius = 0.004;
        //public animateStartSize = Mummu.AnimationFactory.EmptyNumberCallback;
        this.animateEndSize = Mummu.AnimationFactory.EmptyNumberCallback;
        this.wait = Mummu.AnimationFactory.EmptyVoidCallback;
        this.material = this.puzzle.game.materials.whiteFullLitMaterial;
        this.position.copyFrom(this.puzzle.blackboard.position);
        this.position.z += 0.001;
        this.start = BABYLON.MeshBuilder.CreateDisc("bb-puzzle-hint-start", { radius: this.radius, tessellation: 32 });
        this.start.material = this.material;
        //this.start.rotation.x = - Math.PI / 2;
        this.start.parent = this;
        this.startSize = 0;
        this.end = BABYLON.MeshBuilder.CreateDisc("bb-puzzle-hint-end", { radius: this.radius, tessellation: 32 });
        this.end.material = this.material;
        //this.end.rotation.x = - Math.PI / 2;
        this.end.parent = this;
        this.end.isVisible = false;
        this.endSize = 0;
        this.drawnPath = new BABYLON.Mesh("bb-puzzle-hint-path");
        this.drawnPath.material = this.material;
        this.drawnPath.parent = this;
        //this.animateStartSize = Mummu.AnimationFactory.CreateNumber(this.start, this, "startSize");
        this.animateEndSize = Mummu.AnimationFactory.CreateNumber(this.end, this, "endSize");
        this.wait = Mummu.AnimationFactory.CreateWait(this);
    }
    get startSize() {
        return this.start.scaling.x;
    }
    set startSize(v) {
        this.start.scaling.copyFromFloats(v, v, v);
    }
    get endSize() {
        return this.end.scaling.x;
    }
    set endSize(v) {
        this.end.scaling.copyFromFloats(v, v, v);
    }
    setIsVisible(v) {
        this.isVisible = v;
        this.start.isVisible = v;
        this.end.isVisible = v;
        this.drawnPath.isVisible = v;
    }
    async run() {
        if (this.path.length >= 2) {
            this.start.position.copyFrom(this.path[0]);
            this.startSize = 1;
            this.start.isVisible = this.isVisible;
            this.end.position.copyFrom(this.path[0]);
            this.endSize = 1;
            this.end.isVisible = this.isVisible;
            (new BABYLON.VertexData()).applyToMesh(this.drawnPath);
        }
        await this.animateEndSize(2, 0.5);
        if (this.isDisposed()) {
            return;
        }
        let drawnPoints = [this.path[0]];
        let t0 = performance.now();
        let duration = this.path.length * 0.15;
        let f = 0;
        while (f < 1) {
            f = (performance.now() - t0) / 1000 / duration;
            f = Math.min(f, 1);
            Mummu.EvaluatePathToRef(f, this.path, this.end.position);
            let last = drawnPoints[drawnPoints.length - 1];
            if (BABYLON.Vector3.Distance(last, this.end.position) > 0.005) {
                drawnPoints.push(this.end.position.clone());
            }
            if (drawnPoints.length >= 2) {
                let data = Mummu.CreateTrailVertexData({
                    path: [...drawnPoints, this.end.position],
                    color: new BABYLON.Color4(1, 1, 1, 1),
                    radius: this.radius,
                    up: new BABYLON.Vector3(0, 0, -1)
                });
                data.applyToMesh(this.drawnPath, true);
            }
            await this.wait(0);
            if (this.isDisposed()) {
                return;
            }
        }
        await this.animateEndSize(1, 0.3);
        if (this.isDisposed()) {
            return;
        }
    }
}
function setOutlineParams(mesh, renderOutline, outlineWidth, outlineColor) {
    mesh.renderOutline = renderOutline;
    mesh.outlineWidth = outlineWidth;
    mesh.outlineColor = outlineColor;
    mesh.getChildMeshes(true).forEach(child => {
        if (child instanceof BABYLON.Mesh) {
            setOutlineParams(child, renderOutline, outlineWidth, outlineColor);
        }
    });
}
var NewBallMaterial;
(function (NewBallMaterial) {
    NewBallMaterial[NewBallMaterial["Steel"] = 0] = "Steel";
    NewBallMaterial[NewBallMaterial["Random"] = 1] = "Random";
    NewBallMaterial[NewBallMaterial["Last"] = 2] = "Last";
})(NewBallMaterial || (NewBallMaterial = {}));
var DragAxises;
(function (DragAxises) {
    DragAxises[DragAxises["AxisX"] = 0] = "AxisX";
    DragAxises[DragAxises["AxisY"] = 1] = "AxisY";
    DragAxises[DragAxises["AxisZ"] = 2] = "AxisZ";
    DragAxises[DragAxises["AxisXZ"] = 3] = "AxisXZ";
})(DragAxises || (DragAxises = {}));
class HeightArrow extends BABYLON.Mesh {
}
class MachineEditor {
    constructor(game) {
        this.game = game;
        this.allowClickToAddMachinePart = true;
        this.inputEnabled = true;
        this.items = new Map();
        this.handles = [];
        this.lastBallMaterialIndex = 0;
        this.drawBlackboardMode = false;
        this.drawBlackboardPath = [];
        //public grid: MachineEditorGrid;
        this.dragPlaneY = 0;
        this.lastSelectedColors = [0, 0, 0, 0, 0];
        this.buildZoneCenter = new BABYLON.Vector3(0, 0, 0);
        this.buildZoneMin = new BABYLON.Vector3(-0.5, 0, -0.5);
        this.buildZoneMax = new BABYLON.Vector3(0.5, 0, 0.5);
        this._selectedItem = "";
        this._dragRotation = 0;
        this._dragOffset = BABYLON.Vector3.Zero();
        this.dragAxises = [];
        this._majDown = false;
        this._ctrlDown = false;
        this.selectedObjects = [];
        this.allowAutoMirrorXOnDrag = true;
        this.allowEditMachinePart = true;
        this._pointerDownCount = 0;
        this._pointerDownX = 0;
        this._pointerDownY = 0;
        this.pointerDown = (event) => {
            this._pointerDownX = (event.clientX - this.game.canvasLeft) * window.devicePixelRatio;
            this._pointerDownY = event.clientY * window.devicePixelRatio;
            if (!this.inputEnabled) {
                return;
            }
            this._pointerDownCount++;
            if (this.draggedObject) {
                return;
            }
            //console.log("machine editor pointer down");
            let rect = this.container.getBoundingClientRect();
            if (event.x < rect.width) {
                if (event.y > rect.top) {
                    //console.log("why you go here ?");
                    return;
                }
            }
            if (this.selectedObject) {
                let pick;
                // Blackboard Draw case v
                if (this.selectedObject instanceof Core.BlackBoard && this.drawBlackboardMode) {
                    pick = this.game.scene.pick((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, (mesh) => {
                        if (this.selectedObject instanceof Core.BlackBoard && mesh instanceof Core.BlackBoardPiece) {
                            return true;
                        }
                        return false;
                    });
                }
                // Blackboard Draw case ^
                if (!pick || !pick.hit) {
                    pick = this.game.scene.pick((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, (mesh) => {
                        if (this.selectedObject instanceof Core.MachinePart && mesh === this.verticalHandle && mesh.isVisible) {
                            return true;
                        }
                        if (this.selectedObject instanceof Core.Ball && mesh === this.verticalHandle && mesh.isVisible) {
                            return true;
                        }
                        return false;
                    });
                }
                if (!pick.hit) {
                    pick = this.game.scene.pick((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, (mesh) => {
                        if (mesh instanceof Core.EndpointSelectorMesh && mesh.endpoint.machinePart === this.selectedObject) {
                            return true;
                        }
                        return false;
                    });
                }
                if (!pick.hit) {
                    pick = this.game.scene.pick((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, (mesh) => {
                        if (mesh instanceof Core.MachinePartSelectorMesh && mesh.part === this.selectedObject) {
                            return true;
                        }
                        if (mesh instanceof Core.MachineDecorSelector && mesh.machineDecor === this.selectedObject) {
                            return true;
                        }
                        return false;
                    });
                }
                if (!pick.hit) {
                    pick = this.game.scene.pick((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, (mesh) => {
                        if (!this.challengeMode && mesh instanceof Core.BallGhost) {
                            return true;
                        }
                        if (mesh instanceof Core.MachineDecorSelector) {
                            return true;
                        }
                        if (mesh instanceof Core.Block) {
                            return true;
                        }
                        return false;
                    });
                }
                if (!pick.hit) {
                    pick = this.game.scene.pick((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, (mesh) => {
                        if (mesh instanceof Core.MachinePartSelectorMesh && mesh.part.isSelectable) {
                            return true;
                        }
                        if (mesh instanceof Core.EndpointSelectorMesh && mesh.endpoint.machinePart.isSelectable) {
                            return true;
                        }
                        return false;
                    });
                }
                if (pick.hit) {
                    let pickedObject;
                    if (pick.pickedMesh instanceof Core.BallGhost) {
                        pickedObject = pick.pickedMesh.ball;
                    }
                    else if (pick.pickedMesh instanceof Core.MachineDecorSelector) {
                        pickedObject = pick.pickedMesh.machineDecor;
                    }
                    else if (pick.pickedMesh instanceof Core.MachinePartSelectorMesh) {
                        pickedObject = pick.pickedMesh.part;
                    }
                    else if (pick.pickedMesh instanceof Core.EndpointSelectorMesh) {
                        pickedObject = pick.pickedMesh.endpoint.machinePart;
                    }
                    else if (pick.pickedMesh instanceof Core.Block) {
                        pickedObject = pick.pickedMesh;
                    }
                    else if (pick.pickedMesh === this.verticalHandle) {
                        pickedObject = this.selectedObject;
                    }
                    if (this.selectedObject instanceof Core.BlackBoard && this.drawBlackboardMode) {
                        this.drawBlackboardPath = [];
                    }
                    else if (pick.pickedMesh === this.verticalHandle) {
                        let pickingRay = this.game.scene.createPickingRay((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, BABYLON.Matrix.Identity(), this.game.arcCamera, false);
                        pickingRay.direction.normalize();
                        let camDir = this.game.arcCamera.getDirection(BABYLON.Axis.Z);
                        let planeVerticalNorm = camDir;
                        let x = BABYLON.Vector3.Cross(BABYLON.Axis.Y, planeVerticalNorm);
                        planeVerticalNorm = BABYLON.Vector3.Cross(x, BABYLON.Axis.Y);
                        this._dragOffset.copyFrom(pickedObject.position).subtractInPlace(pick.pickedPoint);
                        if (planeVerticalNorm) {
                            let projIntersection = Mummu.RayPlaneIntersection(pickingRay, this.verticalHandle.absolutePosition, planeVerticalNorm);
                            if (projIntersection.hit) {
                                this._dragOffset.copyFrom(pickedObject.position).subtractInPlace(projIntersection.point);
                            }
                        }
                        this.setDraggedObject(this.verticalHandle);
                    }
                    else if (!this._majDown && this.selectedObjects.indexOf(pickedObject) != -1) {
                        let bestEndpointIndex = -1;
                        if (pickedObject instanceof Core.MachinePart) {
                            this._dragOffset.copyFrom(pickedObject.position).subtractInPlace(pick.pickedPoint);
                            bestEndpointIndex = this.findClosestEndpointIndex(pickedObject, pick.pickedPoint);
                        }
                        else if (pickedObject instanceof Core.Ball) {
                            this._dragOffset.copyFrom(pickedObject.positionZero).subtractInPlace(pick.pickedPoint);
                        }
                        else if (pickedObject instanceof Core.MachineDecor) {
                            this._dragOffset.copyFrom(pickedObject.position).subtractInPlace(pick.pickedPoint);
                        }
                        else if (pickedObject instanceof Core.Block) {
                            bestEndpointIndex = pickedObject.worldPosToIndex(pick.pickedPoint);
                            this._dragOffset.copyFromFloats(0, 0, 0);
                        }
                        else {
                            this._dragOffset.copyFromFloats(0, 0, 0);
                        }
                        if (this.allowEditMachinePart &&
                            pick.pickedMesh instanceof Core.EndpointSelectorMesh &&
                            bestEndpointIndex != -1 &&
                            pick.pickedMesh.endpoint.machinePart.extendable) {
                            let endpoint = pick.pickedMesh.endpoint;
                            this._dragOffset.copyFrom(endpoint.absolutePosition).subtractInPlace(pick.pickedPoint);
                            this.setDraggedObject(endpoint, endpoint.index);
                            this.setDraggedEndpointOrigin(endpoint);
                        }
                        else {
                            this.setDraggedObject(pickedObject, bestEndpointIndex);
                            this.dragPlaneY = pick.pickedPoint.y;
                        }
                    }
                }
            }
            if (this.onNextPointerMoveOverScene) {
                this.pointerMove(event);
            }
        };
        this.selectedEndpointIndex = -1;
        this._processingPointerMove = false;
        this.pointerMove = async (event) => {
            if (!this.inputEnabled) {
                return;
            }
            let rect = this.container.getBoundingClientRect();
            if (event.x < rect.width) {
                if (event.y > rect.top) {
                    return;
                }
            }
            if (this._processingPointerMove) {
                return;
            }
            this.selectedEndpoint = undefined;
            this._processingPointerMove = true;
            if (this.onNextPointerMoveOverScene) {
                await this.onNextPointerMoveOverScene();
                this.onNextPointerMoveOverScene = undefined;
            }
            if (this._pointerDownCount > 0 && this.drawBlackboardMode && this.selectedObject instanceof Core.BlackBoard) {
                let pickingRay = this.game.scene.createPickingRay((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, BABYLON.Matrix.Identity(), this.game.arcCamera, false);
                let projIntersection = Mummu.RayPlaneIntersection(pickingRay, this.selectedObject.position, BABYLON.Axis.Z);
                if (projIntersection.hit) {
                    let invMatrix = this.selectedObject.getWorldMatrix().clone().invert();
                    let localPosition = BABYLON.Vector3.TransformCoordinates(projIntersection.point, invMatrix);
                    let last = this.drawBlackboardPath[this.drawBlackboardPath.length - 1];
                    if (!last || BABYLON.Vector3.DistanceSquared(last, localPosition) > 0.014 * 0.014) {
                        this.drawBlackboardPath.push(localPosition);
                        this.drawBlackboardCurrentPointer = undefined;
                    }
                    else {
                        this.drawBlackboardCurrentPointer = localPosition;
                    }
                }
            }
            else if (this.draggedObject) {
                let pickingRay = this.game.scene.createPickingRay((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, BABYLON.Matrix.Identity(), this.game.arcCamera, false);
                pickingRay.direction.normalize();
                if (true) {
                    if (this.draggedObject === this.verticalHandle && this.selectedObject instanceof Core.MachinePart) {
                        let camDir = this.game.arcCamera.getDirection(BABYLON.Axis.Z);
                        let planeVerticalNorm = camDir;
                        let x = BABYLON.Vector3.Cross(BABYLON.Axis.Y, planeVerticalNorm);
                        planeVerticalNorm = BABYLON.Vector3.Cross(x, BABYLON.Axis.Y);
                        if (planeVerticalNorm) {
                            let projIntersection = Mummu.RayPlaneIntersection(pickingRay, this.verticalHandle.absolutePosition, planeVerticalNorm);
                            if (projIntersection.hit) {
                                let pos = this.selectedObject.getAbsoluteAfterUpdateCoordinatesPosition();
                                let delta = projIntersection.point.subtract(pos).add(this._dragOffset);
                                let dK = Math.round(delta.y / Core.tileHeight);
                                if (dK != 0) {
                                    for (let n = 0; n < this.selectedObjects.length; n++) {
                                        let selectedObject = this.selectedObjects[n];
                                        if (selectedObject instanceof Core.MachinePart) {
                                            selectedObject.setTargetK(selectedObject.kAfterUpdate + dK);
                                            this.updateFloatingElements();
                                        }
                                    }
                                }
                            }
                        }
                        this.setDraggedObject(this.verticalHandle);
                    }
                    else if (this.draggedObject === this.verticalHandle && this.selectedObject instanceof Core.Ball) {
                        let camDir = this.game.arcCamera.getDirection(BABYLON.Axis.Z);
                        let planeVerticalNorm = camDir;
                        let x = BABYLON.Vector3.Cross(BABYLON.Axis.Y, planeVerticalNorm);
                        planeVerticalNorm = BABYLON.Vector3.Cross(x, BABYLON.Axis.Y);
                        if (planeVerticalNorm) {
                            let projIntersection = Mummu.RayPlaneIntersection(pickingRay, this.verticalHandle.absolutePosition, planeVerticalNorm);
                            if (projIntersection.hit) {
                                let pos = this.selectedObject.positionZero;
                                let delta = projIntersection.point.subtract(pos).add(this._dragOffset);
                                if (delta.y != 0) {
                                    this.selectedObject.setPositionZero(new BABYLON.Vector3(this.selectedObject.positionZero.x, this.selectedObject.positionZero.y + delta.y, this.selectedObject.positionZero.z));
                                    this.selectedObject.reset();
                                    this.updateFloatingElements();
                                }
                            }
                        }
                        this.setDraggedObject(this.verticalHandle);
                    }
                    else if (this.draggedObject instanceof Core.Block) {
                        let index = this.selectedEndpointIndex;
                        if (index % 2 === 0) {
                            let projIntersection = Mummu.RayPlaneIntersection(pickingRay, this.draggedObject.position, BABYLON.Axis.Z);
                            if (projIntersection.hit) {
                                let p = projIntersection.point.clone();
                                p.x = Math.round(p.x / Core.tileSize) * Core.tileSize;
                                p.y = Math.round(p.y / Core.tileHeight) * Core.tileHeight;
                                p.z = Math.round(p.z / Core.tileSize) * Core.tileSize;
                                this.draggedObject.line[index / 2].copyFrom(p);
                                this.draggedObject.instantiate();
                            }
                        }
                    }
                    else if (this.draggedObject instanceof Core.MachinePartEndpoint) {
                        if (this.selectedObject instanceof Core.MachinePart) {
                            let bestDistToAxis = Infinity;
                            let bestProjIntersection;
                            let xAxis;
                            let zAxis;
                            let xzAxis;
                            let yAxis;
                            if (this.dragAxises[DragAxises.AxisX].isVisible && this.selectedObject.lExtendableOnX) {
                                xAxis = this.selectedObject.getDirection(BABYLON.Axis.X);
                                let camDir = this.game.arcCamera.getDirection(BABYLON.Axis.Z);
                                let planeNorm = camDir;
                                let y = BABYLON.Vector3.Cross(planeNorm, xAxis);
                                planeNorm = BABYLON.Vector3.Cross(xAxis, y);
                                if (planeNorm) {
                                    let lengthProjIntersection = Mummu.RayPlaneIntersection(pickingRay, this._draggedEndpointOrigin.position, planeNorm);
                                    if (lengthProjIntersection.hit) {
                                        this._clampIntoBuildZoneToRef(lengthProjIntersection.point, lengthProjIntersection.point);
                                        let distToAxis = Mummu.DistancePointRay(lengthProjIntersection.point, this._draggedEndpointOrigin.position, xAxis);
                                        if (distToAxis < bestDistToAxis) {
                                            bestDistToAxis = distToAxis;
                                            this.selectedEndpoint = this.draggedObject;
                                            bestProjIntersection = Mummu.ProjectPointOnLine(lengthProjIntersection.point, this._draggedEndpointOrigin.position, this._draggedEndpointOrigin.position.add(xAxis));
                                            let delta = bestProjIntersection.subtract(this.selectedEndpoint.absolutePosition);
                                        }
                                    }
                                }
                            }
                            if (this.dragAxises[DragAxises.AxisZ].isVisible && (this.selectedObject.lExtendableOnZ || this.selectedObject.dExtendableOnZ)) {
                                zAxis = this.selectedObject.getDirection(BABYLON.Axis.Z);
                                let camDir = this.game.arcCamera.getDirection(BABYLON.Axis.Z);
                                let planeNorm = camDir;
                                let y = BABYLON.Vector3.Cross(planeNorm, zAxis);
                                planeNorm = BABYLON.Vector3.Cross(zAxis, y);
                                if (planeNorm) {
                                    let lengthProjIntersection = Mummu.RayPlaneIntersection(pickingRay, this._draggedEndpointOrigin.position, planeNorm);
                                    if (lengthProjIntersection.hit) {
                                        this._clampIntoBuildZoneToRef(lengthProjIntersection.point, lengthProjIntersection.point);
                                        let distToAxis = Mummu.DistancePointRay(lengthProjIntersection.point, this._draggedEndpointOrigin.position, zAxis);
                                        if (distToAxis < bestDistToAxis) {
                                            bestDistToAxis = distToAxis;
                                            this.selectedEndpoint = this.draggedObject;
                                            bestProjIntersection = Mummu.ProjectPointOnLine(lengthProjIntersection.point, this._draggedEndpointOrigin.position, this._draggedEndpointOrigin.position.add(zAxis));
                                        }
                                    }
                                }
                            }
                            if (this.dragAxises[DragAxises.AxisXZ].isVisible && this.selectedObject.lExtendableOnXZ) {
                                xzAxis = this.selectedObject.getDirection(new BABYLON.Vector3(1, 0, 1));
                                xzAxis.normalize();
                                let camDir = this.game.arcCamera.getDirection(BABYLON.Axis.Z);
                                let planeNorm = camDir;
                                let y = BABYLON.Vector3.Cross(planeNorm, xzAxis);
                                planeNorm = BABYLON.Vector3.Cross(xzAxis, y);
                                if (planeNorm) {
                                    let lengthProjIntersection = Mummu.RayPlaneIntersection(pickingRay, this._draggedEndpointOrigin.position, planeNorm);
                                    if (lengthProjIntersection.hit) {
                                        this._clampIntoBuildZoneToRef(lengthProjIntersection.point, lengthProjIntersection.point);
                                        let distToAxis = Mummu.DistancePointRay(lengthProjIntersection.point, this._draggedEndpointOrigin.position, xzAxis);
                                        if (distToAxis < bestDistToAxis) {
                                            bestDistToAxis = distToAxis;
                                            this.selectedEndpoint = this.draggedObject;
                                            bestProjIntersection = Mummu.ProjectPointOnLine(lengthProjIntersection.point, this._draggedEndpointOrigin.position, this._draggedEndpointOrigin.position.add(xzAxis));
                                        }
                                    }
                                }
                            }
                            if (this.dragAxises[DragAxises.AxisY].isVisible && this.selectedObject.hExtendableOnY) {
                                yAxis = this.selectedObject.getDirection(new BABYLON.Vector3(0, 1, 0));
                                let camDir = this.game.arcCamera.getDirection(BABYLON.Axis.Z);
                                let planeNorm = camDir;
                                let x = BABYLON.Vector3.Cross(yAxis, planeNorm);
                                planeNorm = BABYLON.Vector3.Cross(x, yAxis);
                                if (planeNorm) {
                                    let heightProjIntersection = Mummu.RayPlaneIntersection(pickingRay, this._draggedEndpointOrigin.position, planeNorm);
                                    if (heightProjIntersection.hit) {
                                        this._clampIntoBuildZoneToRef(heightProjIntersection.point, heightProjIntersection.point);
                                        let distToAxis = Mummu.DistancePointRay(heightProjIntersection.point, this._draggedEndpointOrigin.position, yAxis);
                                        if (distToAxis < bestDistToAxis) {
                                            bestDistToAxis = distToAxis;
                                            this.selectedEndpoint = this.draggedObject;
                                            bestProjIntersection = Mummu.ProjectPointOnLine(heightProjIntersection.point, this._draggedEndpointOrigin.position, this._draggedEndpointOrigin.position.add(yAxis));
                                        }
                                    }
                                }
                            }
                            if (this.dragAxises[DragAxises.AxisX].isVisible && this.selectedObject.lExtendableOnX) {
                                let delta = bestProjIntersection.subtract(this.selectedEndpoint.absolutePosition);
                                let dL = Math.round(BABYLON.Vector3.Dot(delta, xAxis) / Core.tileSize);
                                if (dL != 0) {
                                    if (this.selectedObject instanceof Core.MachinePart && this.draggedObject instanceof Core.MachinePartEndpoint) {
                                        let editedPart = await addToTrackLengthInPlace(this.selectedObject, dL, new BABYLON.Vector3(1, 0, 0), this.draggedObject.isOrigin);
                                        this.setSelectedObject(editedPart);
                                        if (editedPart instanceof Core.MultiJoin) {
                                            let aimedEndpoint = MachineEditorNodeFinder.findAimedEndpointOnMachinePart(pickingRay, this.machine, editedPart);
                                            if (aimedEndpoint) {
                                                let aimedEndpointIndex = editedPart.endPoints.indexOf(aimedEndpoint);
                                                if (aimedEndpointIndex != -1) {
                                                    this.setDraggedObject(aimedEndpoint, aimedEndpointIndex);
                                                }
                                            }
                                        }
                                        else {
                                            this.setDraggedObject(editedPart.endPoints[this.selectedEndpointIndex], this.selectedEndpointIndex);
                                        }
                                    }
                                }
                            }
                            if (this.dragAxises[DragAxises.AxisZ].isVisible && this.selectedObject.lExtendableOnZ) {
                                let delta = bestProjIntersection.subtract(this.selectedEndpoint.absolutePosition);
                                let dL = Math.round(BABYLON.Vector3.Dot(delta, zAxis) / Core.tileSize);
                                if (dL != 0) {
                                    if (this.selectedObject instanceof Core.MachinePart && this.draggedObject instanceof Core.MachinePartEndpoint) {
                                        let editedPart = await addToTrackLengthInPlace(this.selectedObject, dL, new BABYLON.Vector3(0, 0, 1), this.draggedObject.isOrigin);
                                        this.setSelectedObject(editedPart);
                                        this.setDraggedObject(editedPart.endPoints[this.selectedEndpointIndex], this.selectedEndpointIndex);
                                    }
                                }
                            }
                            if (this.dragAxises[DragAxises.AxisZ].isVisible && this.selectedObject.dExtendableOnZ) {
                                let delta = bestProjIntersection.subtract(this.selectedEndpoint.absolutePosition);
                                let dD = Math.round(BABYLON.Vector3.Dot(delta, zAxis) / Core.tileSize);
                                if (dD != 0) {
                                    if (this.selectedObject instanceof Core.MachinePart && this.draggedObject instanceof Core.MachinePartEndpoint) {
                                        let editedPart = await addToTrackDepthInPlace(this.selectedObject, dD, new BABYLON.Vector3(0, 0, 1), this.draggedObject.isOrigin);
                                        this.setSelectedObject(editedPart);
                                        this.setDraggedObject(editedPart.endPoints[this.selectedEndpointIndex], this.selectedEndpointIndex);
                                    }
                                }
                            }
                            if (this.dragAxises[DragAxises.AxisXZ].isVisible && this.selectedObject.lExtendableOnXZ) {
                                let delta = bestProjIntersection.subtract(this.selectedEndpoint.absolutePosition);
                                let dL = Math.round(BABYLON.Vector3.Dot(delta, xzAxis) / (Core.tileSize * Math.SQRT2));
                                if (dL != 0) {
                                    if (this.selectedObject instanceof Core.MachinePart && this.draggedObject instanceof Core.MachinePartEndpoint) {
                                        let editedPart = await addToTrackLengthInPlace(this.selectedObject, dL, new BABYLON.Vector3(1, 0, 1), this.draggedObject.isOrigin);
                                        this.setSelectedObject(editedPart);
                                        this.setDraggedObject(editedPart.endPoints[this.selectedEndpointIndex], this.selectedEndpointIndex);
                                    }
                                }
                            }
                            if (this.dragAxises[DragAxises.AxisY].isVisible && this.selectedObject.hExtendableOnY) {
                                let delta = bestProjIntersection.subtract(this.selectedEndpoint.absolutePosition);
                                let dL = Math.round(BABYLON.Vector3.Dot(delta, yAxis) / Core.tileHeight);
                                if (dL != 0) {
                                    if (this.selectedObject instanceof Core.MachinePart && this.draggedObject instanceof Core.MachinePartEndpoint) {
                                        let editedPart = await addToTrackHeightInPlace(this.selectedObject, dL, this.draggedObject.isOrigin, this.draggedObject.machinePart.downwardYExtendable);
                                        this.setSelectedObject(editedPart);
                                        this.setDraggedObject(editedPart.endPoints[this.selectedEndpointIndex], this.selectedEndpointIndex);
                                    }
                                }
                            }
                        }
                    }
                    else {
                        if (this.draggedObject instanceof Core.MachinePart) {
                            let aimedEndpoint;
                            if (this.selectedObjectsCount === 1) {
                                let aimedEndpoints = MachineEditorNodeFinder.findAimedEndpoints(pickingRay, this.machine, this.draggedObject);
                                aimedEndpoint = aimedEndpoints[0];
                            }
                            if (aimedEndpoint) {
                                let selectedEndpoint = this.draggedObject.endPoints[this.selectedEndpointIndex];
                                if (!selectedEndpoint) {
                                    selectedEndpoint = this.draggedObject.endPoints[0];
                                }
                                let point = aimedEndpoint.absolutePosition.clone();
                                //Mummu.DrawDebugPoint(point, 60, BABYLON.Color3.Green(), 0.05);
                                let r = (aimedEndpoint.absoluteR + 6 - selectedEndpoint.localR) % 4;
                                let debugDir = Mummu.Rotate(BABYLON.Axis.X, BABYLON.Axis.Y, -aimedEndpoint.absoluteR * Math.PI * 0.5);
                                point.subtractInPlace(debugDir.scale(Core.tileSize * 0.5));
                                Mummu.DrawDebugPoint(point, 60, BABYLON.Color3.Blue(), 0.05);
                                let i = Math.round(point.x / Core.tileSize) - selectedEndpoint.getRotatedI(r);
                                let j = Math.round(point.z / Core.tileSize) - selectedEndpoint.getRotatedJ(r);
                                let k = Math.round(point.y / Core.tileHeight - selectedEndpoint.k);
                                //Mummu.DrawDebugLine(point, point.add(debugDir.scale(0.05)), 60, BABYLON.Color3.Red());
                                let di = i - this.draggedObject.iAfterUpdate;
                                let dj = j - this.draggedObject.jAfterUpdate;
                                let dk = k - this.draggedObject.kAfterUpdate;
                                let dr = r - this.draggedObject.rAfterUpdate;
                                if (di != 0 || dj != 0 || dk != 0 || dr != 0) {
                                    let dAngle = -Math.PI * 0.5 * dr;
                                    if (this._dragRotation === -1) {
                                        this._dragRotation = this.draggedObject.rAfterUpdate;
                                    }
                                    if (this.draggedObject.isVisible) {
                                        if (!this.draggedObject.intersectsAnyBlock(i, j, k)) {
                                            this.draggedObject.setTargetI(i, true);
                                            this.draggedObject.setTargetJ(this.mode === Core.MachineConstructionMode.Mode2D ? 0 : j, true);
                                            this.draggedObject.setTargetK(k, true);
                                            this.draggedObject.setTargetR(r);
                                        }
                                    }
                                    else {
                                        this.draggedObject.setI(i, true);
                                        this.draggedObject.setJ(this.mode === Core.MachineConstructionMode.Mode2D ? 0 : j, true);
                                        this.draggedObject.setK(k, true);
                                        this.draggedObject.setR(r);
                                    }
                                    Mummu.RotateInPlace(this._dragOffset, BABYLON.Axis.Y, dAngle);
                                    this.draggedObject.recomputeAbsolutePath();
                                    //this.draggedObject.rebuildWireMeshes(true);
                                    this.draggedObject.setIsVisible(true);
                                    this.updateFloatingElements();
                                }
                            }
                            else {
                                let pick;
                                if (this.mode === Core.MachineConstructionMode.Mode3D) {
                                    pick = Mummu.RayPlaneIntersection(pickingRay, new BABYLON.Vector3(0, this.dragPlaneY, 0), BABYLON.Axis.Y);
                                }
                                else if (this.mode == Core.MachineConstructionMode.Mode2D) {
                                    pick = Mummu.RayPlaneIntersection(pickingRay, new BABYLON.Vector3(0, 0, 0), BABYLON.Axis.Z);
                                }
                                if (pick.hit) {
                                    this._clampIntoBuildZoneToRef(pick.point, pick.point);
                                    let point = pick.point.add(this._dragOffset);
                                    let i = Math.round(point.x / Core.tileSize);
                                    let j = Math.round(point.z / Core.tileSize);
                                    let k = Math.round(point.y / Core.tileHeight);
                                    let di = i - this.draggedObject.iAfterUpdate;
                                    let dj = j - this.draggedObject.jAfterUpdate;
                                    let dk = k - this.draggedObject.kAfterUpdate;
                                    if (di != 0 || dj != 0 || dk != 0) {
                                        for (let n = 0; n < this.selectedObjects.length; n++) {
                                            let selectedObject = this.selectedObjects[n];
                                            if (selectedObject instanceof Core.MachinePart && selectedObject != this.draggedObject) {
                                                selectedObject.setTargetI(selectedObject.iAfterUpdate + di);
                                                selectedObject.setTargetJ(this.mode === Core.MachineConstructionMode.Mode2D ? 0 : (selectedObject.jAfterUpdate + dj), this.mode === Core.MachineConstructionMode.Mode2D);
                                                selectedObject.setTargetK(selectedObject.kAfterUpdate + dk);
                                            }
                                        }
                                        if (this.draggedObject.isVisible) {
                                            let intersectionV = this.draggedObject.intersectsAnyBlock(i, j, k);
                                            for (let n = 0; n < 1; n++) {
                                                if (intersectionV > 0) {
                                                    intersectionV = Math.floor(Math.random() * 3 + 1);
                                                    if (intersectionV === 1) {
                                                        i = this.draggedObject.iAfterUpdate;
                                                    }
                                                    if (intersectionV === 2) {
                                                        j = this.draggedObject.jAfterUpdate;
                                                    }
                                                    if (intersectionV === 3) {
                                                        k = this.draggedObject.kAfterUpdate;
                                                    }
                                                    intersectionV = this.draggedObject.intersectsAnyBlock(i, j, k);
                                                }
                                            }
                                            if (intersectionV === 0) {
                                                this.draggedObject.setTargetI(i);
                                                this.draggedObject.setTargetJ(this.mode === Core.MachineConstructionMode.Mode2D ? 0 : j, this.mode === Core.MachineConstructionMode.Mode2D);
                                                this.draggedObject.setTargetK(k);
                                                if (this._dragRotation != -1 && this.draggedObject.rAfterUpdate != this._dragRotation) {
                                                    let dr = this._dragRotation - this.draggedObject.rAfterUpdate;
                                                    let dAngle = -Math.PI * 0.5 * dr;
                                                    Mummu.RotateInPlace(this._dragOffset, BABYLON.Axis.Y, dAngle);
                                                    this.draggedObject.setTargetR(this._dragRotation);
                                                    this._dragRotation = -1;
                                                }
                                            }
                                        }
                                        else {
                                            this.draggedObject.setI(i);
                                            this.draggedObject.setJ(this.mode === Core.MachineConstructionMode.Mode2D ? 0 : j, this.mode === Core.MachineConstructionMode.Mode2D);
                                            this.draggedObject.setK(k);
                                        }
                                        this.draggedObject.recomputeAbsolutePath();
                                        //this.draggedObject.rebuildWireMeshes(true);
                                        this.draggedObject.setIsVisible(true);
                                        this.updateFloatingElements();
                                    }
                                }
                                else {
                                    if (this.draggedObject instanceof Core.Ball || this.draggedObject instanceof Core.MachinePart) {
                                        this.draggedObject.setIsVisible(false);
                                    }
                                }
                            }
                        }
                        else {
                            let pick;
                            if (this.mode === Core.MachineConstructionMode.Mode3D) {
                                pick = Mummu.RayPlaneIntersection(pickingRay, new BABYLON.Vector3(0, this.dragPlaneY, 0), BABYLON.Axis.Y);
                            }
                            else if (this.mode == Core.MachineConstructionMode.Mode2D) {
                                pick = Mummu.RayPlaneIntersection(pickingRay, new BABYLON.Vector3(0, 0, 0), BABYLON.Axis.Z);
                            }
                            if (pick.hit) {
                                if (this.draggedObject instanceof Core.Ball) {
                                    let pickOnTrack = this.game.scene.pick((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, (mesh) => {
                                        if (mesh instanceof Core.MachinePartSelectorMesh && mesh.part.isSelectable) {
                                            return true;
                                        }
                                        return false;
                                    });
                                    let aimedMachinePart;
                                    if (pickOnTrack.hit && pickOnTrack.pickedMesh instanceof Core.MachinePartSelectorMesh) {
                                        aimedMachinePart = pickOnTrack.pickedMesh.part;
                                    }
                                    if (aimedMachinePart && aimedMachinePart.tracks[0] && aimedMachinePart.tracks[0].template.isWood) {
                                        let track = aimedMachinePart.tracks[0];
                                        if (track instanceof Core.WoodTrack) {
                                            let pickingInfo = pickingRay.intersectsMesh(track.mesh);
                                            if (pickingInfo.hit) {
                                                let point = pickingInfo.pickedPoint;
                                                let up = BABYLON.Vector3.Up();
                                                this.draggedObject.setPositionZero(point.add(up.scale(this.draggedObject.radius)));
                                                this.draggedObject.setIsVisible(true);
                                                this.updateFloatingElements();
                                                if (!this.machine.playing) {
                                                    this.draggedObject.reset();
                                                }
                                            }
                                        }
                                    }
                                    else if (aimedMachinePart) {
                                        let point = BABYLON.Vector3.Zero();
                                        let up = BABYLON.Vector3.Up();
                                        let dir = BABYLON.Vector3.Right();
                                        aimedMachinePart.getProjection(pickOnTrack.pickedPoint, point, dir, up);
                                        this.draggedObject.setPositionZero(point.add(up.scale(0.005)));
                                        this.draggedObject.setIsVisible(true);
                                        this.updateFloatingElements();
                                        if (!this.machine.playing) {
                                            this.draggedObject.reset();
                                        }
                                    }
                                    else {
                                        this._clampIntoBuildZoneToRef(pick.point, pick.point);
                                        let point = pick.point.add(this._dragOffset);
                                        if (this.is2DMode) {
                                            point.z = 0;
                                        }
                                        //point.y = this.draggedObject.positionZero.y;
                                        this.draggedObject.setPositionZero(point);
                                        this.draggedObject.setIsVisible(true);
                                        this.updateFloatingElements();
                                        if (!this.machine.playing) {
                                            this.draggedObject.reset();
                                        }
                                    }
                                }
                                else if (this.draggedObject instanceof Core.MachineDecor) {
                                    let pickOnTrack = this.game.scene.pick((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, (mesh) => {
                                        if (mesh instanceof Core.MachinePartSelectorMesh && mesh.part.isSelectable) {
                                            return true;
                                        }
                                        if (mesh instanceof Core.EndpointSelectorMesh && mesh.endpoint.machinePart.isSelectable) {
                                            return true;
                                        }
                                        return false;
                                    });
                                    let point = pick.point.add(this._dragOffset);
                                    let aimedMachinePart;
                                    if (pickOnTrack.hit && pickOnTrack.pickedMesh instanceof Core.MachinePartSelectorMesh) {
                                        aimedMachinePart = pickOnTrack.pickedMesh.part;
                                    }
                                    else if (pickOnTrack.hit && pickOnTrack.pickedMesh instanceof Core.EndpointSelectorMesh) {
                                        aimedMachinePart = pickOnTrack.pickedMesh.endpoint.machinePart;
                                    }
                                    if (aimedMachinePart) {
                                        let up = BABYLON.Vector3.Up();
                                        let dir = BABYLON.Vector3.Right();
                                        aimedMachinePart.getProjection(pickOnTrack.pickedPoint, point, dir, up);
                                        this.draggedObject.setPosition(point);
                                        this.draggedObject.setDirAndUp(dir, up);
                                    }
                                    else {
                                        this.draggedObject.setPosition(point);
                                    }
                                    this.updateFloatingElements();
                                }
                            }
                            else {
                                if (this.draggedObject instanceof Core.Ball || this.draggedObject instanceof Core.MachinePart) {
                                    this.draggedObject.setIsVisible(false);
                                }
                            }
                        }
                    }
                }
            }
            else {
                if (this.is2DMode && isFinite(this._pointerDownX) && isFinite(this._pointerDownY) && this._pointerDownCount === 1) {
                    this.game.arcCamera.target.x -= event.movementX / 2000;
                    this.game.arcCamera.target.y += event.movementY / 2000;
                }
            }
            this._processingPointerMove = false;
        };
        this.pointerUp = (event) => {
            if (!this.inputEnabled) {
                return;
            }
            this._pointerDownCount = 0;
            //console.log("machine editor pointer up");
            this.aimedEndpoint = undefined;
            this.selectedEndpoint = undefined;
            this.setDraggedEndpointOrigin(undefined);
            this.setSelectedItem("");
            let dx = (this._pointerDownX - ((event.clientX - this.game.canvasLeft) * window.devicePixelRatio));
            let dy = (this._pointerDownY - event.clientY * window.devicePixelRatio);
            this._pointerDownX = undefined;
            this._pointerDownY = undefined;
            let clickInPlace = dx * dx + dy * dy < 10;
            let rect = this.container.getBoundingClientRect();
            if (event.x < rect.width) {
                if (event.y > rect.top) {
                    if (!this.allowClickToAddMachinePart || !clickInPlace) {
                        this.doCancelPendingInsertionCaller();
                    }
                    return;
                }
            }
            if (this.drawBlackboardMode && this.selectedObject instanceof Core.BlackBoard && this.drawBlackboardPath.length > 2) {
                if (this.drawBlackboardCurrentPointer) {
                    this.drawBlackboardPath.push(this.drawBlackboardCurrentPointer);
                }
                this.selectedObject.addRawLine(this.drawBlackboardPath);
                this.drawBlackboardPath = [];
                this.drawBlackboardCurrentPointer = undefined;
                this.selectedObject.regenerateTemplate();
                this.selectedObject.instantiate(true);
                if (this.game.bbPuzzle.undoneGhost) {
                    this.game.bbPuzzle.undoneGhost.dispose();
                }
            }
            // First, check for handle pick
            if (clickInPlace) {
                let pickHandle = this.game.scene.pick((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, (mesh) => {
                    if (mesh === this.turnRightHandle && mesh.isVisible) {
                        return true;
                    }
                    if (mesh === this.turnLeftHandle && mesh.isVisible) {
                        return true;
                    }
                    if (mesh === this.turn2DHandle && mesh.isVisible) {
                        return true;
                    }
                    return false;
                });
                if (pickHandle.hit && (pickHandle.pickedMesh === this.turnRightHandle || pickHandle.pickedMesh === this.turn2DHandle)) {
                    if (this.selectedObject instanceof Core.MachinePart) {
                        this.setDraggedObject(undefined);
                        this._onRPlus();
                        return;
                    }
                }
                if (pickHandle.hit && pickHandle.pickedMesh === this.turnLeftHandle) {
                    if (this.selectedObject instanceof Core.MachinePart) {
                        this.setDraggedObject(undefined);
                        if (this.is3DMode) {
                            this._onRMinus();
                        }
                        else if (this.is2DMode) {
                            this._onRPlus();
                        }
                        return;
                    }
                }
            }
            else {
                this.setSelectedItem(undefined);
            }
            let pick = this.game.scene.pick((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, (mesh) => {
                if (!this.challengeMode && !this.draggedObject && mesh instanceof Core.BallGhost) {
                    return true;
                }
                else if (!this.challengeMode && !this.draggedObject && mesh instanceof Core.MachineDecorSelector) {
                    return true;
                }
                return false;
            });
            if (!pick.hit) {
                pick = this.game.scene.pick((event.clientX - this.game.canvasLeft) * window.devicePixelRatio, event.clientY * window.devicePixelRatio, (mesh) => {
                    if (!this.draggedObject && mesh instanceof Core.MachinePartSelectorMesh && mesh.part.isSelectable) {
                        return true;
                    }
                    if (!this.draggedObject && mesh instanceof Core.EndpointSelectorMesh && mesh.endpoint.machinePart.isSelectable) {
                        return true;
                    }
                    if (!this.draggedObject && mesh instanceof Core.MachineDecorSelector) {
                        return true;
                    }
                    if (!this.draggedObject && mesh instanceof Core.Block) {
                        return true;
                    }
                    return false;
                });
            }
            if (this.draggedObject instanceof Core.MachinePart) {
                let draggedTrack = this.draggedObject;
                if (this.machine.parts.indexOf(draggedTrack) === -1) {
                    this.machine.parts.push(draggedTrack);
                }
                draggedTrack.setIsVisible(true);
                draggedTrack.isPlaced = true;
                draggedTrack.generateWires();
                draggedTrack.instantiate(true).then(async () => {
                    draggedTrack.recomputeAbsolutePath();
                    let selectedObjects = [...this.selectedObjects];
                    this.setSelectedObject(draggedTrack);
                    for (let i = 0; i < selectedObjects.length; i++) {
                        let selectedObject = selectedObjects[i];
                        if (selectedObject instanceof Core.MachinePart && selectedObject != draggedTrack) {
                            selectedObject.generateWires();
                            await selectedObject.instantiate(true);
                            selectedObject.recomputeAbsolutePath();
                            this.addOrRemoveSelectedObjects(selectedObject);
                        }
                    }
                    this.setDraggedObject(undefined);
                    this.updateFloatingElements();
                });
                this.machine.generateBaseMesh();
                this._cancelPendingInsertion = undefined;
            }
            else if (this.draggedObject instanceof Core.Ball) {
                if (this.machine.balls.indexOf(this.draggedObject) === -1) {
                    this.machine.balls.push(this.draggedObject);
                }
                this.draggedObject.setIsVisible(true);
                this.draggedObject.updateFrozenStatus();
                this.draggedObject.reset();
                this.setSelectedObject(this.draggedObject);
                this.setDraggedObject(undefined);
                this.updateFloatingElements();
                this._cancelPendingInsertion = undefined;
            }
            else if (this.draggedObject instanceof Core.MachineDecor) {
                if (this.machine.decors.indexOf(this.draggedObject) === -1) {
                    this.machine.decors.push(this.draggedObject);
                }
                this.setSelectedObject(this.draggedObject);
                this.setDraggedObject(undefined);
                this.updateFloatingElements();
                this._cancelPendingInsertion = undefined;
            }
            else if (this.draggedObject instanceof Core.MachinePartEndpoint) {
                this.setSelectedObject(this.draggedObject.machinePart);
                this.setDraggedObject(undefined);
                this.updateFloatingElements();
                this.machine.generateBaseMesh();
                this._cancelPendingInsertion = undefined;
            }
            else if (this.draggedObject === this.verticalHandle) {
                this.setDraggedObject(undefined);
                this.updateFloatingElements();
                this.machine.generateBaseMesh();
                this._cancelPendingInsertion = undefined;
            }
            else if (this.draggedObject instanceof Core.Block) {
                if (this.game.inputManager.isKeyInputDown(KeyInput.CTRL)) {
                    if (this.selectedEndpointIndex % 2 === 1) {
                        this.draggedObject.splitAtIndex(this.selectedEndpointIndex);
                    }
                }
                this.draggedObject.clean();
                this.draggedObject.instantiate();
                this.setDraggedObject(undefined);
                this.updateFloatingElements();
                this.machine.generateBaseMesh();
                this._cancelPendingInsertion = undefined;
            }
            else if (pick.hit) {
                if (clickInPlace) {
                    if (pick.pickedMesh instanceof Core.BallGhost) {
                        this.setSelectedObject(pick.pickedMesh.ball);
                    }
                    else if (pick.pickedMesh instanceof Core.MachineDecorSelector) {
                        if (this._majDown) {
                            this.addOrRemoveSelectedObjects(pick.pickedMesh.machineDecor);
                        }
                        else {
                            this.setSelectedObject(pick.pickedMesh.machineDecor);
                        }
                    }
                    else if (pick.pickedMesh instanceof Core.MachinePartSelectorMesh) {
                        if (this._majDown) {
                            this.addOrRemoveSelectedObjects(pick.pickedMesh.part);
                        }
                        else {
                            this.setSelectedObject(pick.pickedMesh.part);
                        }
                    }
                    else if (pick.pickedMesh instanceof Core.EndpointSelectorMesh) {
                        if (this._majDown) {
                            this.addOrRemoveSelectedObjects(pick.pickedMesh.endpoint.machinePart);
                        }
                        else {
                            this.setSelectedObject(pick.pickedMesh.endpoint.machinePart);
                        }
                    }
                    else if (pick.pickedMesh instanceof Core.Block) {
                        this.setSelectedObject(pick.pickedMesh);
                    }
                }
            }
            else {
                if (clickInPlace) {
                    this.setSelectedObject(undefined);
                }
            }
        };
        this.doCancelPendingInsertionCaller = () => {
            this.onNextPointerMoveOverScene = undefined;
            this.setSelectedItem("");
            if (this._cancelPendingInsertion) {
                this._cancelPendingInsertion();
            }
        };
        this.actionTileSize = 0.018;
        this._onKeyDown = (event) => {
            if (event.code === "ShiftLeft") {
                this._majDown = true;
            }
            else if (event.code === "ControlLeft") {
                this._ctrlDown = true;
            }
            else if (this._ctrlDown && event.key === "a") {
                this.setSelectedObject(undefined);
                this.addOrRemoveSelectedObjects(...this.machine.parts);
            }
            /*
            else if (event.key === "o") {
                if (location.host.startsWith("127.0.0.1")) {
                    if (!this.xylomaker) {
                        this.xylomaker = new XyloMaker(this);
                    }
                    this.xylomaker.reset();
                    this.xylomaker.ball = this.machine.balls[0];
                    let onNextPlay = () => {
                        this.xylomaker.start();
                        this.machine.onPlayCallbacks.remove(onNextPlay);
                    }
                    this.machine.onPlayCallbacks.push(onNextPlay);
                    let onNextStop = () => {
                        this.xylomaker.stop();
                        this.machine.onPlayCallbacks.remove(onNextStop);
                    }
                    this.machine.onPlayCallbacks.push(onNextStop);
                }
            }
            */
        };
        this._onKeyUp = (event) => {
            if (event.code === "ShiftLeft") {
                this._majDown = false;
            }
            else if (event.code === "ControlLeft") {
                this._ctrlDown = false;
            }
        };
        this._onDelete = async () => {
            this.selectedObjects.forEach(obj => {
                if (obj instanceof Core.MachinePart) {
                    if (obj.onBeforeDelete) {
                        obj.onBeforeDelete();
                    }
                }
                obj.dispose();
            });
            this.setSelectedObject(undefined);
            this.setDraggedObject(undefined);
            this.machine.generateBaseMesh();
        };
        this._onIPlus = async () => {
            if (this.game.inputManager.isKeyInputDown(KeyInput.CTRL)) {
                return;
            }
            if (this.selectedObjects.length > 0) {
                let center = this.getSelectedObjectsCenter();
                if (center.x > this.buildZoneCenter.x) {
                    let corner;
                    if (center.z > this.buildZoneCenter.z) {
                        corner = this.getSelectedObjectsAABBMin();
                    }
                    else {
                        corner = this.getSelectedObjectsAABBMin();
                        corner.z = this.getSelectedObjectsAABBMax().z;
                    }
                    if (!this._isIntoBuildZone(corner)) {
                        return;
                    }
                }
            }
            for (let i = 0; i < this.selectedObjects.length; i++) {
                let selectedTrack = this.selectedObjects[i];
                if (selectedTrack instanceof Core.MachinePart) {
                    selectedTrack.setTargetI(selectedTrack.iAfterUpdate + 1);
                    if (this.game.cameraMode === CameraMode.Selected) {
                        this._onFocus();
                    }
                }
            }
            this.setDraggedObject(undefined);
            this.updateFloatingElements();
        };
        this._onIMinus = async () => {
            if (this.game.inputManager.isKeyInputDown(KeyInput.CTRL)) {
                return;
            }
            if (this.selectedObjects.length > 0) {
                let center = this.getSelectedObjectsCenter();
                if (center.x < this.buildZoneCenter.x) {
                    let corner;
                    if (center.z < this.buildZoneCenter.z) {
                        corner = this.getSelectedObjectsAABBMax();
                    }
                    else {
                        corner = this.getSelectedObjectsAABBMax();
                        corner.z = this.getSelectedObjectsAABBMin().z;
                    }
                    if (!this._isIntoBuildZone(corner)) {
                        return;
                    }
                }
            }
            for (let i = 0; i < this.selectedObjects.length; i++) {
                let selectedTrack = this.selectedObjects[i];
                if (selectedTrack instanceof Core.MachinePart) {
                    selectedTrack.setTargetI(selectedTrack.iAfterUpdate - 1);
                    if (this.game.cameraMode === CameraMode.Selected) {
                        this._onFocus();
                    }
                }
            }
            this.setDraggedObject(undefined);
            this.updateFloatingElements();
        };
        this._onJPlus = async () => {
            if (this.game.inputManager.isKeyInputDown(KeyInput.CTRL)) {
                return;
            }
            if (this.is2DMode) {
                return;
            }
            if (this.selectedObjects.length > 0) {
                let center = this.getSelectedObjectsCenter();
                if (center.z > this.buildZoneCenter.z) {
                    let corner;
                    if (center.x > this.buildZoneCenter.x) {
                        corner = this.getSelectedObjectsAABBMin();
                    }
                    else {
                        corner = this.getSelectedObjectsAABBMin();
                        corner.x = this.getSelectedObjectsAABBMax().x;
                    }
                    if (!this._isIntoBuildZone(corner)) {
                        return;
                    }
                }
            }
            for (let i = 0; i < this.selectedObjects.length; i++) {
                let selectedTrack = this.selectedObjects[i];
                if (selectedTrack instanceof Core.MachinePart) {
                    selectedTrack.setTargetJ(selectedTrack.jAfterUpdate + 1, this.mode === Core.MachineConstructionMode.Mode2D);
                    if (this.game.cameraMode === CameraMode.Selected) {
                        this._onFocus();
                    }
                }
            }
            this.setDraggedObject(undefined);
            this.updateFloatingElements();
        };
        this._onJMinus = async () => {
            if (this.game.inputManager.isKeyInputDown(KeyInput.CTRL)) {
                return;
            }
            if (this.is2DMode) {
                return;
            }
            if (this.selectedObjects.length > 0) {
                let center = this.getSelectedObjectsCenter();
                if (center.z < this.buildZoneCenter.z) {
                    let corner;
                    if (center.x < this.buildZoneCenter.x) {
                        corner = this.getSelectedObjectsAABBMax();
                    }
                    else {
                        corner = this.getSelectedObjectsAABBMax();
                        corner.x = this.getSelectedObjectsAABBMin().x;
                    }
                    if (!this._isIntoBuildZone(corner)) {
                        return;
                    }
                }
            }
            for (let i = 0; i < this.selectedObjects.length; i++) {
                let selectedTrack = this.selectedObjects[i];
                if (selectedTrack instanceof Core.MachinePart) {
                    selectedTrack.setTargetJ(selectedTrack.jAfterUpdate - 1, this.mode === Core.MachineConstructionMode.Mode2D);
                    if (this.game.cameraMode === CameraMode.Selected) {
                        this._onFocus();
                    }
                }
            }
            this.setDraggedObject(undefined);
            this.updateFloatingElements();
        };
        this._onKPlus = async () => {
            if (this.game.inputManager.isKeyInputDown(KeyInput.CTRL)) {
                return;
            }
            if (this.selectedObjects.length > 0) {
                let corner = this.getSelectedObjectsCenter();
                corner.y = this.getSelectedObjectsAABBMin().y;
                if (corner.y > this.buildZoneMax.y) {
                    return;
                }
            }
            if (this.selectedObject instanceof Core.MachinePart) {
                for (let i = 0; i < this.selectedObjects.length; i++) {
                    let selectedTrack = this.selectedObjects[i];
                    if (selectedTrack instanceof Core.MachinePart) {
                        selectedTrack.setTargetK(selectedTrack.kAfterUpdate + 1);
                        if (this.game.cameraMode === CameraMode.Selected) {
                            this._onFocus();
                        }
                    }
                }
                this.setDraggedObject(undefined);
                this.updateFloatingElements();
            }
            else if (this.selectedObject instanceof Core.Ball) {
                this.selectedObject.k = this.selectedObject.k + 1;
                this.setSelectedObject(this.selectedObject);
                this.updateFloatingElements();
                if (!this.machine.playing) {
                    this.selectedObject.reset();
                }
            }
        };
        this._onKMinus = async () => {
            if (this.game.inputManager.isKeyInputDown(KeyInput.CTRL)) {
                return;
            }
            if (this.selectedObject instanceof Core.MachinePart) {
                for (let i = 0; i < this.selectedObjects.length; i++) {
                    let selectedTrack = this.selectedObjects[i];
                    if (selectedTrack instanceof Core.MachinePart) {
                        selectedTrack.setTargetK(selectedTrack.kAfterUpdate - 1);
                        if (this.game.cameraMode === CameraMode.Selected) {
                            this._onFocus();
                        }
                    }
                }
                this.setDraggedObject(undefined);
                this.updateFloatingElements();
            }
            else if (this.selectedObject instanceof Core.Ball) {
                this.selectedObject.k = this.selectedObject.k - 1;
                this.setSelectedObject(this.selectedObject);
                this.updateFloatingElements();
                if (!this.machine.playing) {
                    this.selectedObject.reset();
                }
            }
        };
        this._onRPlus = async () => {
            if (this.game.inputManager.isKeyInputDown(KeyInput.CTRL)) {
                return;
            }
            if (this.selectedObject instanceof Core.MachinePart) {
                for (let i = 0; i < this.selectedObjects.length; i++) {
                    let selectedTrack = this.selectedObjects[i];
                    let angle = -Math.PI * 0.5;
                    let dR = 1;
                    if (this.mode === Core.MachineConstructionMode.Mode2D) {
                        angle = -Math.PI;
                        dR = 2;
                    }
                    if (selectedTrack instanceof Core.MachinePart) {
                        let localBarycenterIJK = selectedTrack.localBarycenterIJK;
                        let rotatedLocalBarycenterIJK = Mummu.Rotate(localBarycenterIJK, BABYLON.Axis.Y, -Math.PI * 0.5 * selectedTrack.rAfterUpdate);
                        let newI = selectedTrack.iAfterUpdate;
                        let newJ = selectedTrack.jAfterUpdate;
                        newI += rotatedLocalBarycenterIJK.x;
                        newJ += rotatedLocalBarycenterIJK.z;
                        rotatedLocalBarycenterIJK = Mummu.Rotate(rotatedLocalBarycenterIJK, BABYLON.Axis.Y, angle);
                        newI -= rotatedLocalBarycenterIJK.x;
                        newJ -= rotatedLocalBarycenterIJK.z;
                        if (this.is3DMode) {
                            let r = selectedTrack.rAfterUpdate;
                            let wPair = selectedTrack.visibleWidth % 2 === 0;
                            let dPair = selectedTrack.visibleDepth % 2 === 0;
                            if (wPair && dPair) {
                                if (r === 0) {
                                    newJ -= 1;
                                }
                                if (r === 1) {
                                    newI += 1;
                                }
                                if (r === 2) {
                                    newJ += 1;
                                }
                                if (r === 3) {
                                    newI -= 1;
                                }
                            }
                            else if (wPair) {
                                if (r === 0) {
                                    newI += 1;
                                    newJ -= 1;
                                }
                                if (r === 1) {
                                    newJ += 1;
                                }
                                if (r === 3) {
                                    newI -= 1;
                                }
                            }
                            else if (dPair) {
                                if (r === 0) {
                                    newJ -= 1;
                                }
                                else if (r === 2) {
                                    newI += 1;
                                }
                                else if (r === 3) {
                                    newI -= 1;
                                    newJ += 1;
                                }
                            }
                        }
                        else if (this.is2DMode) {
                            let r = selectedTrack.rAfterUpdate;
                            let wPair = selectedTrack.visibleWidth % 2 === 0;
                            if (wPair) {
                                if (r === 0) {
                                    newI += 1;
                                }
                                if (r === 2) {
                                    newI -= 1;
                                }
                            }
                            else {
                            }
                        }
                        selectedTrack.targetUpdatePivot = selectedTrack.worldAABBMax.add(selectedTrack.worldAABBMin).scaleInPlace(0.5);
                        selectedTrack.targetUpdatePivot.z -= 0.001;
                        selectedTrack.setTargetR(selectedTrack.rAfterUpdate + dR);
                        selectedTrack.setTargetI(Math.round(newI), true);
                        selectedTrack.setTargetJ(Math.round(newJ), true);
                        if (this.game.cameraMode === CameraMode.Selected) {
                            this._onFocus();
                        }
                    }
                }
                this.setDraggedObject(undefined);
                this.updateFloatingElements();
            }
            else if (this.selectedObject instanceof Core.Ball) {
                this.selectedObject.k = this.selectedObject.k + 1;
                this.setSelectedObject(this.selectedObject);
                this.updateFloatingElements();
                if (!this.machine.playing) {
                    this.selectedObject.reset();
                }
            }
        };
        this._onRMinus = async () => {
            if (this.game.inputManager.isKeyInputDown(KeyInput.CTRL)) {
                return;
            }
            if (this.mode === Core.MachineConstructionMode.Mode2D) {
                return;
            }
            if (this.selectedObject instanceof Core.MachinePart) {
                for (let i = 0; i < this.selectedObjects.length; i++) {
                    let selectedTrack = this.selectedObjects[i];
                    if (selectedTrack instanceof Core.MachinePart) {
                        let localBarycenterIJK = selectedTrack.localBarycenterIJK;
                        let rotatedLocalBarycenterIJK = Mummu.Rotate(localBarycenterIJK, BABYLON.Axis.Y, -Math.PI * 0.5 * selectedTrack.rAfterUpdate);
                        let newI = selectedTrack.iAfterUpdate;
                        let newJ = selectedTrack.jAfterUpdate;
                        newI += rotatedLocalBarycenterIJK.x;
                        newJ += rotatedLocalBarycenterIJK.z;
                        rotatedLocalBarycenterIJK = Mummu.Rotate(rotatedLocalBarycenterIJK, BABYLON.Axis.Y, Math.PI * 0.5);
                        newI -= rotatedLocalBarycenterIJK.x;
                        newJ -= rotatedLocalBarycenterIJK.z;
                        let r = selectedTrack.rAfterUpdate;
                        let wPair = selectedTrack.visibleWidth % 2 === 0;
                        let dPair = selectedTrack.visibleDepth % 2 === 0;
                        if (wPair && dPair) {
                            if (r === 0) {
                                newI += 1;
                            }
                            if (r === 1) {
                                newJ += 1;
                            }
                            if (r === 2) {
                                newI -= 1;
                            }
                            if (r === 3) {
                                newJ -= 1;
                            }
                        }
                        else if (wPair) {
                            if (r === 0) {
                                newI += 1;
                            }
                            if (r === 2) {
                                newJ -= 1;
                            }
                            if (r === 1) {
                                newI -= 1;
                                newJ += 1;
                            }
                        }
                        else if (dPair) {
                            if (r === 0) {
                                newI += 1;
                                newJ -= 1;
                            }
                            else if (r === 3) {
                                newI -= 1;
                            }
                            else if (r === 1) {
                                newJ += 1;
                            }
                        }
                        selectedTrack.targetUpdatePivot = selectedTrack.worldAABBMax.add(selectedTrack.worldAABBMin).scaleInPlace(0.5);
                        selectedTrack.setTargetR(selectedTrack.rAfterUpdate - 1);
                        selectedTrack.setTargetI(Math.round(newI), true);
                        selectedTrack.setTargetJ(Math.round(newJ), true);
                        if (this.game.cameraMode === CameraMode.Selected) {
                            this._onFocus();
                        }
                    }
                }
                this.setDraggedObject(undefined);
                this.updateFloatingElements();
            }
            else if (this.selectedObject instanceof Core.Ball) {
                this.selectedObject.k = this.selectedObject.k + 1;
                this.setSelectedObject(this.selectedObject);
                this.updateFloatingElements();
                if (!this.machine.playing) {
                    this.selectedObject.reset();
                }
            }
        };
        this._onFill = () => {
            if (this.selectedObject instanceof Core.Elevator) {
                let elevator = this.selectedObject;
                // Remove all balls located in the Elevator vicinity.
                let currentBallsInElevator = [];
                for (let i = 0; i < this.machine.balls.length; i++) {
                    let ball = this.machine.balls[i];
                    let posLocal = ball.positionZero.subtract(elevator.position);
                    if (elevator.worldAABBMin.x < ball.positionZero.x && ball.positionZero.x < elevator.worldAABBMax.x) {
                        if (elevator.worldAABBMin.y < ball.positionZero.y && ball.positionZero.y < elevator.worldAABBMax.y) {
                            if (elevator.worldAABBMin.z < ball.positionZero.z && ball.positionZero.z < elevator.worldAABBMax.z) {
                                currentBallsInElevator.push(ball);
                            }
                        }
                    }
                }
                for (let i = 0; i < currentBallsInElevator.length; i++) {
                    currentBallsInElevator[i].dispose();
                }
                elevator.reset();
                requestAnimationFrame(() => {
                    let nBalls = Math.floor(elevator.boxesCount / 2);
                    for (let i = 0; i < nBalls; i++) {
                        let box = elevator.boxes[i];
                        let pos = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(-0.012 * (elevator.mirrorX ? -1 : 1), 0.01, 0), box.getWorldMatrix());
                        let materialIndex = 0;
                        if (this.game.config.getValue("newBallMaterial") === NewBallMaterial.Last) {
                            materialIndex = this.lastBallMaterialIndex;
                        }
                        else if (this.game.config.getValue("newBallMaterial") === NewBallMaterial.Random) {
                            materialIndex = Math.floor(this.game.materials.ballMaterialsCount * Math.random());
                        }
                        let ball = new Core.Ball(pos, this.machine, materialIndex);
                        ball.instantiate().then(() => {
                            ball.setShowPositionZeroGhost(true);
                            ball.setIsVisible(true);
                        });
                        this.machine.balls.push(ball);
                        ball.updateFrozenStatus();
                    }
                });
            }
        };
        this._onFocus = () => {
            if (this.selectedObjectsCount > 0) {
                this.game.focusMachineParts(false, false, ...this.selectedObjects);
            }
        };
        this.container = document.getElementById("machine-editor-toolbar");
        this.itemContainer = this.container.querySelector("#machine-editor-item-container");
        this.machinePartEditorMenu = new MachinePartEditorMenu(this);
        this.endpointGizmoManager = new EndpointGizmoManager(this);
    }
    get machine() {
        return this.game.machine;
    }
    get mode() {
        return this.machine.constructionMode;
    }
    get is2DMode() {
        return this.mode === Core.MachineConstructionMode.Mode2D;
    }
    get is3DMode() {
        return this.mode === Core.MachineConstructionMode.Mode3D;
    }
    get hoveredObject() {
        return this._hoveredObject;
    }
    set hoveredObject(o) {
        if (o != this._hoveredObject) {
            if (this._hoveredObject) {
                this._hoveredObject.anhover();
            }
            this._hoveredObject = o;
            if (this._hoveredObject) {
                this._hoveredObject.hover();
            }
        }
    }
    getCurrentItemElement() {
        return this.items.get(this._selectedItem);
    }
    get selectedItem() {
        return this._selectedItem;
    }
    setSelectedItem(s) {
        if (s != this._selectedItem) {
            let e = this.getCurrentItemElement();
            if (e) {
                e.classList.remove("selected");
            }
            this._selectedItem = s;
            e = this.getCurrentItemElement();
            if (e) {
                e.classList.add("selected");
            }
        }
    }
    setDraggedEndpointOrigin(endpoint) {
        if (endpoint) {
            this._draggedEndpointOrigin.position.copyFrom(endpoint.absolutePosition);
            this._draggedEndpointOrigin.rotation.copyFrom(endpoint.machinePart.rotation);
        }
    }
    get draggedObject() {
        return this._draggedObject;
    }
    setDraggedObject(s, selectedEndPointIndex = -1) {
        this.selectedEndpointIndex = selectedEndPointIndex;
        if (s != this._draggedObject) {
            this._draggedObject = s;
            this._dragRotation = -1;
            if (this._draggedObject) {
                this.game.arcCamera.detachControl();
                //this.showCurrentLayer();
            }
            else {
                this.game.arcCamera.attachControl();
                //this.hideCurrentLayer();
            }
            if (this._draggedObject instanceof Core.MachinePart) {
                this._draggedObject.removeAllNeighbours();
            }
            if (this._draggedObject instanceof Core.MachinePartEndpoint) {
                //this.grid.setPosition(this._draggedObject.absolutePosition);
                //this._dragOffset.copyFromFloats(0, 0, 0);
            }
        }
        this._updateBuildZoneLimits();
    }
    get selectedObjectsCount() {
        return this.selectedObjects.length;
    }
    get selectedObject() {
        return this.selectedObjects[0];
    }
    setSelectedObject(s, skipUpdateGridPosition) {
        if (this.selectedObjects) {
            this.selectedObjects.forEach(obj => {
                obj.unselect();
            });
        }
        if (s) {
            this.selectedObjects = [s];
            if (this.game.cameraMode === CameraMode.Selected) {
                this._onFocus();
            }
        }
        else {
            this.selectedObjects = [];
        }
        if (this.selectedObjects[0]) {
            this.selectedObjects[0].select();
            this.machinePartEditorMenu.currentObject = this.selectedObjects[0];
        }
        else {
            this.machinePartEditorMenu.currentObject = undefined;
        }
        this.updateFloatingElements();
    }
    addOrRemoveSelectedObjects(...objects) {
        for (let i = 0; i < objects.length; i++) {
            let object = objects[i];
            if (!(this.challengeMode && (object instanceof Core.MachinePart && !object.isSelectable || !(object instanceof Core.MachinePart)))) {
                let index = this.selectedObjects.indexOf(object);
                if (index === -1) {
                    if (this.selectedObjects[0]) {
                        this.selectedObjects[0].select(true);
                    }
                    this.selectedObjects.push(object);
                    object.select(true);
                }
                else {
                    this.selectedObjects.splice(index, 1);
                    object.unselect();
                }
            }
        }
        if (this.game.cameraMode === CameraMode.Selected) {
            this._onFocus();
        }
        if (this.selectedObjectsCount === 1) {
            this.machinePartEditorMenu.currentObject = this.selectedObject;
        }
        if (this.selectedObjectsCount > 1) {
            this.machinePartEditorMenu.setCurrentObjects(this.selectedObjects);
        }
        this.updateFloatingElements();
    }
    getSelectedObjectsCenter() {
        let center = BABYLON.Vector3.Zero();
        let n = 0;
        for (let i = 0; i < this.selectedObjects.length; i++) {
            let selectedObject = this.selectedObjects[i];
            if (selectedObject instanceof Core.MachinePart) {
                let p = selectedObject.localRotatedAABBMin.add(selectedObject.localRotatedAABBMax);
                p.scaleInPlace(0.5);
                p.x += selectedObject.iAfterUpdate * Core.tileSize;
                p.z += selectedObject.jAfterUpdate * Core.tileSize;
                p.y += selectedObject.kAfterUpdate * Core.tileHeight;
                center.addInPlace(p);
                n++;
            }
        }
        if (n > 0) {
            center.scaleInPlace(1 / n);
        }
        return center;
    }
    getSelectedObjectsAABBMin() {
        let AABBMin = new BABYLON.Vector3(10, 10, 10);
        for (let i = 0; i < this.selectedObjects.length; i++) {
            let selectedObject = this.selectedObjects[i];
            if (selectedObject instanceof Core.MachinePart) {
                let p = selectedObject.localRotatedAABBMin.clone();
                p.x += selectedObject.iAfterUpdate * Core.tileSize;
                p.z += selectedObject.jAfterUpdate * Core.tileSize;
                p.y += selectedObject.kAfterUpdate * Core.tileHeight;
                AABBMin.x = Math.min(AABBMin.x, p.x);
                AABBMin.y = Math.min(AABBMin.y, p.y);
                AABBMin.z = Math.min(AABBMin.z, p.z);
            }
        }
        return AABBMin;
    }
    getSelectedObjectsAABBMax() {
        let AABBMax = new BABYLON.Vector3(-10, -10, -10);
        for (let i = 0; i < this.selectedObjects.length; i++) {
            let selectedObject = this.selectedObjects[i];
            if (selectedObject instanceof Core.MachinePart) {
                let p = selectedObject.localRotatedAABBMax.clone();
                p.x += selectedObject.iAfterUpdate * Core.tileSize;
                p.z += selectedObject.jAfterUpdate * Core.tileSize;
                p.y += selectedObject.kAfterUpdate * Core.tileHeight;
                AABBMax.x = Math.max(AABBMax.x, p.x);
                AABBMax.y = Math.max(AABBMax.y, p.y);
                AABBMax.z = Math.max(AABBMax.z, p.z);
            }
        }
        return AABBMax;
    }
    get challengeMode() {
        return this.game.mode === GameMode.Challenge && (this.game.challenge.mode === ChallengeMode.Tutorial || this.game.challenge.mode === ChallengeMode.Puzzle) || this.game.mode === GameMode.BBPuzzle;
    }
    getItemCount(trackName) {
        if (this.itemsCounts) {
            return this.itemsCounts.get(trackName);
        }
        return 0;
    }
    setItemCount(trackName, c) {
        if (this.itemsCounts) {
            this.itemsCounts.set(trackName, c);
            let e = document.querySelector("#machine-editor-objects");
            if (e) {
                e = e.querySelector("[track='" + trackName + "']");
                if (e) {
                    e = e.querySelector("div.machine-editor-item-count");
                    if (e instanceof HTMLDivElement) {
                        if (isFinite(c)) {
                            e.innerHTML = c.toFixed(0);
                        }
                        else {
                            //e.innerHTML = "&#8734;";
                            e.innerHTML = "";
                        }
                    }
                }
            }
        }
    }
    async instantiate() {
        this.container.style.display = "";
        this.machinePartEditorMenu.initialize();
        this.itemsCounts = new Map();
        let constructionModePill = this.container.querySelector("#machine-editor-mode-pill");
        if (constructionModePill) {
            if (this.challengeMode) {
                constructionModePill.style.display = "none";
            }
            else {
                constructionModePill.style.display = "";
                if (this.is3DMode) {
                    constructionModePill.innerHTML = "3D 模式";
                }
                if (this.is2DMode) {
                    constructionModePill.innerHTML = "2D 模式";
                }
            }
        }
        let ballItem;
        let blockItem;
        let drawBlackboardItem;
        if (!this.challengeMode) {
            ballItem = document.createElement("div");
            ballItem.classList.add("machine-editor-item");
            ballItem.style.backgroundImage = "url(./datas/icons-mrs/machine-part/ball.png)";
            ballItem.style.backgroundSize = "cover";
            this.itemContainer.appendChild(ballItem);
            this.items.set("ball", ballItem);
            let itemNameElement = document.createElement("div");
            itemNameElement.classList.add("machine-editor-item-name");
            itemNameElement.innerHTML = "彈珠";
            ballItem.appendChild(itemNameElement);
            ballItem.addEventListener("pointerdown", (ev) => {
                this._pointerDownX = (ev.clientX - this.game.canvasLeft) * window.devicePixelRatio;
                this._pointerDownY = ev.clientY * window.devicePixelRatio;
                if (this.draggedObject instanceof Core.Ball || this.draggedObject instanceof Core.MachinePart) {
                    this.draggedObject.dispose();
                }
                this.setDraggedObject(undefined);
                this.setSelectedItem("ball");
                let materialIndex = 0;
                if (this.game.config.getValue("newBallMaterial") === NewBallMaterial.Last) {
                    materialIndex = this.lastBallMaterialIndex;
                }
                else if (this.game.config.getValue("newBallMaterial") === NewBallMaterial.Random) {
                    materialIndex = Math.floor(this.game.materials.ballMaterialsCount * Math.random());
                }
                this.onNextPointerMoveOverScene = async () => {
                    let ball = new Core.Ball(BABYLON.Vector3.Zero(), this.machine, materialIndex);
                    await ball.instantiate();
                    ball.setShowPositionZeroGhost(true);
                    this.setDraggedObject(ball);
                    this.setSelectedObject(ball, true);
                    this._dragOffset.copyFromFloats(0, 0, 0);
                };
            });
            if (this.game.DEBUG_MODE) {
                blockItem = document.createElement("div");
                blockItem.classList.add("machine-editor-item");
                blockItem.style.backgroundImage = "url(./datas/icons-mrs/machine-part/block.png)";
                blockItem.style.backgroundSize = "cover";
                this.itemContainer.appendChild(blockItem);
                this.items.set("block", blockItem);
                let blockItemNameElement = document.createElement("div");
                blockItemNameElement.classList.add("machine-editor-item-name");
                blockItemNameElement.innerHTML = "方塊";
                blockItem.appendChild(blockItemNameElement);
                blockItem.addEventListener("pointerdown", (ev) => {
                    let block = new Core.Block(this.machine);
                    block.initialize();
                    this.machine.blocks.push(block);
                    block.instantiate();
                });
            }
        }
        if (!this.challengeMode) {
            if (this.game.DEBUG_MODE) {
                drawBlackboardItem = document.createElement("div");
                drawBlackboardItem.classList.add("machine-editor-item");
                drawBlackboardItem.style.backgroundImage = "url(./datas/icons-mrs/machine-part/draw-blackboard.png)";
                drawBlackboardItem.style.backgroundSize = "cover";
                this.itemContainer.appendChild(drawBlackboardItem);
                this.items.set("draw-blackboard", drawBlackboardItem);
                let drawBlackboardNameElement = document.createElement("div");
                drawBlackboardNameElement.classList.add("machine-editor-item-name");
                drawBlackboardNameElement.innerHTML = "畫板";
                drawBlackboardItem.appendChild(drawBlackboardNameElement);
                drawBlackboardItem.addEventListener("pointerdown", (ev) => {
                    this.drawBlackboardMode = !this.drawBlackboardMode;
                });
            }
        }
        if (!this.challengeMode) {
            if (location.host.startsWith("127.0.0.1") && false) {
                let xylophoneItem = document.createElement("div");
                xylophoneItem.classList.add("machine-editor-item");
                xylophoneItem.style.backgroundImage = "url(./datas/icons-mrs/machine-part/ball.png)";
                xylophoneItem.style.backgroundSize = "cover";
                this.itemContainer.appendChild(xylophoneItem);
                this.items.set("xylophone", xylophoneItem);
                let xylophoneItemNameElement = document.createElement("div");
                xylophoneItemNameElement.classList.add("machine-editor-item-name");
                xylophoneItemNameElement.innerHTML = "木琴";
                xylophoneItem.appendChild(xylophoneItemNameElement);
                xylophoneItem.addEventListener("pointerdown", (ev) => {
                    if (this.draggedObject instanceof Core.Ball || this.draggedObject instanceof Core.MachinePart || this.draggedObject instanceof Core.MachineDecor) {
                        this.draggedObject.dispose();
                    }
                    this.setDraggedObject(undefined);
                    this.setSelectedItem("xylophone");
                    this.onNextPointerMoveOverScene = async () => {
                        let xylophone = new Core.Xylophone(this.machine);
                        await xylophone.instantiate();
                        this.setDraggedObject(xylophone);
                        this.setSelectedObject(xylophone, true);
                        this._dragOffset.copyFromFloats(0, 0, 0);
                    };
                });
            }
        }
        if (this.challengeMode && isFinite(this.game.gridKMin) && isFinite(this.game.gridKMax)) {
            this.dragPlaneY = this.game.gridKMin * Core.tileHeight;
        }
        else {
            this.dragPlaneY = 0;
        }
        let availableTracks = Core.TrackNames;
        let counts = [];
        if (this.challengeMode) {
            availableTracks = [];
            this.game.challenge.availableElements.forEach(trackName => {
                let index = availableTracks.indexOf(trackName);
                if (index === -1) {
                    availableTracks.push(trackName);
                    counts.push(1);
                }
                else {
                    counts[index]++;
                }
            });
        }
        else {
            availableTracks = MachineEditorPartsList.map(emp => { return emp.part; });
            availableTracks = [];
            for (let i = 0; i < MachineEditorPartsList.length; i++) {
                let emp = MachineEditorPartsList[i];
                let doInsert = false;
                if (this.mode === Core.MachineConstructionMode.Mode3D) {
                    doInsert = emp.mode === MachineMode.Only3D || emp.mode === MachineMode.AllD;
                }
                else if (this.mode === Core.MachineConstructionMode.Mode2D) {
                    doInsert = emp.mode === MachineMode.Only2D || emp.mode === MachineMode.AllD;
                }
                else {
                    // it's a bad case, but it's for the best.
                    console.error("Editing a Machine with no constructionMode set.");
                    doInsert = true;
                }
                if (doInsert) {
                    availableTracks.push(emp.part);
                }
            }
            if (location.host.startsWith("127.0.0.1") && this.game.DEBUG_MODE) {
                availableTracks.push(...MachineEditorPartsListDebug.map(emp => { return emp.part; }));
            }
        }
        if (availableTracks.length <= 6) {
            this.container.classList.add("slim");
            this.game.toolbar.container.classList.add("machine-editor-1-line");
        }
        else {
            this.container.classList.remove("slim");
            this.game.toolbar.container.classList.add("machine-editor-2-lines");
        }
        let itemCountOnOneBottomLine = Math.max(Math.ceil(availableTracks.length / 2 + 1), 6);
        var r = document.querySelector(':root');
        r.style.setProperty("--machine-editor-item-container-bottom-width", (itemCountOnOneBottomLine * 84).toFixed(0) + "px");
        let firstNonNewElement = undefined;
        for (let i = 0; i < availableTracks.length; i++) {
            let trackname = availableTracks[i];
            let isNew = MachineEditorNewPartsList.find(o => { return o.part === trackname; }) != undefined;
            let item = document.createElement("div");
            item.classList.add("machine-editor-item");
            item.setAttribute("track", trackname);
            item.style.backgroundImage = "url(./datas/icons-mrs/machine-part/" + trackname + ".png)";
            this.itemContainer.appendChild(item);
            this.items.set(trackname, item);
            let itemNameElement = document.createElement("div");
            itemNameElement.classList.add("machine-editor-item-name");
            let basePartName = trackname.split("[R]")[0].split("_")[0];
            let displayName = MachineEditorDisplayNames.find(medn => { return medn.partName === basePartName; });
            if (displayName) {
                itemNameElement.innerHTML = displayName.displayName;
            }
            else {
                itemNameElement.innerHTML = trackname.split("[R]")[0].split("_")[0];
            }
            item.appendChild(itemNameElement);
            if (isNew) {
                let itemNewElement = document.createElement("div");
                itemNewElement.classList.add("machine-editor-item-new");
                itemNewElement.innerHTML = "新";
                item.appendChild(itemNewElement);
                this.itemContainer.insertBefore(item, firstNonNewElement ? firstNonNewElement : this.itemContainer.firstElementChild);
            }
            else if (!firstNonNewElement) {
                firstNonNewElement = item;
            }
            let itemCountElement = document.createElement("div");
            itemCountElement.classList.add("machine-editor-item-count");
            itemCountElement.innerHTML = "&#8734;";
            item.appendChild(itemCountElement);
            if (isFinite(counts[i])) {
                this.setItemCount(trackname, counts[i]);
            }
            else {
                this.setItemCount(trackname, Infinity);
            }
            item.addEventListener("pointerdown", (ev) => {
                this._pointerDownX = (ev.clientX - this.game.canvasLeft) * window.devicePixelRatio;
                this._pointerDownY = ev.clientY * window.devicePixelRatio;
                ev.stopPropagation();
                if (this.getItemCount(trackname) <= 0) {
                    return;
                }
                if (this.draggedObject instanceof Core.Ball || this.draggedObject instanceof Core.MachinePart) {
                    this.draggedObject.dispose();
                }
                this.setDraggedObject(undefined);
                this.setSelectedItem(trackname);
                this.onNextPointerMoveOverScene = async () => {
                    let colors = [...this.lastSelectedColors];
                    if (this.challengeMode && this.game.challenge.mode === ChallengeMode.Tutorial) {
                        let baseTrackname = trackname.split("[R]")[0].split("_")[0];
                        let tutorialColors = MachineEditorTutorialPartColor.find(pc => { return pc.partName === baseTrackname; });
                        if (!tutorialColors) {
                            tutorialColors = MachineEditorTutorialPartColor.find(pc => { return pc.partName === "default"; });
                        }
                        if (tutorialColors) {
                            colors = tutorialColors.colors;
                        }
                    }
                    let r = 0;
                    if (trackname.endsWith("[R]1")) {
                        r = 1;
                    }
                    if (trackname.endsWith("[R]2")) {
                        r = 2;
                    }
                    if (trackname.endsWith("[R]3")) {
                        r = 3;
                    }
                    let fullPartName = trackname.split("[R]")[0];
                    let track = this.machine.trackFactory.createTrack(fullPartName, {
                        fullPartName: fullPartName,
                        i: 0,
                        j: 0,
                        k: Math.round(this.dragPlaneY / Core.tileHeight),
                        r: r,
                        c: colors
                    });
                    track.isPlaced = false;
                    if (this.challengeMode) {
                        track.onBeforeDelete = () => {
                            this.setItemCount(trackname, this.getItemCount(trackname) + 1);
                        };
                    }
                    this._cancelPendingInsertion = () => {
                        if (track) {
                            if (track.onBeforeDelete) {
                                track.onBeforeDelete();
                            }
                            track.dispose();
                        }
                        this.setDraggedObject(undefined);
                        this.setSelectedObject(undefined);
                    };
                    this._dragOffset.copyFromFloats(0, 0, 0);
                    await track.instantiate(true);
                    this._dragOffset.copyFrom(track.localBarycenter).scaleInPlace(-1);
                    Mummu.RotateInPlace(this._dragOffset, BABYLON.Axis.Y, -Math.PI * 0.5 * track.r);
                    track.setIsVisible(false);
                    this.setSelectedObject(track, true);
                    this.setDraggedObject(track);
                    this.setItemCount(trackname, this.getItemCount(trackname) - 1);
                };
                let scrollContainer = document.querySelector("#machine-editor-objects");
                let prevScrollLeft = scrollContainer.scrollLeft;
                let prevScrollTop = scrollContainer.scrollTop;
                let prevScrollBottom = scrollContainer.clientHeight + scrollContainer.scrollTop;
                // check for touch-action
                let t0 = performance.now();
                let checkLoop = () => {
                    if (scrollContainer.scrollLeft != prevScrollLeft) {
                        this.doCancelPendingInsertionCaller();
                        return;
                    }
                    let scrollBottom = scrollContainer.clientHeight + scrollContainer.scrollTop;
                    if (scrollBottom != prevScrollBottom && scrollContainer.scrollTop != prevScrollTop) {
                        this.doCancelPendingInsertionCaller();
                        return;
                    }
                    if (performance.now() - t0 > 250) {
                        return;
                    }
                    requestAnimationFrame(checkLoop);
                };
                checkLoop();
            });
        }
        if (this.itemContainer.children.length < 6 || this.itemContainer.children.length % 2 === 1) {
            let emptyItem = document.createElement("div");
            emptyItem.classList.add("machine-editor-item");
            emptyItem.classList.add("disabled");
            this.itemContainer.appendChild(emptyItem);
        }
        document.addEventListener("keydown", this._onKeyDown);
        document.addEventListener("keyup", this._onKeyUp);
        this.game.inputManager.addMappedKeyDownListener(KeyInput.EDITOR_MOVE_RIGHT, this._onIPlus);
        this.game.inputManager.addMappedKeyDownListener(KeyInput.EDITOR_MOVE_LEFT, this._onIMinus);
        this.game.inputManager.addMappedKeyDownListener(KeyInput.EDITOR_MOVE_UP, this._onKPlus);
        this.game.inputManager.addMappedKeyDownListener(KeyInput.EDITOR_MOVE_DOWN, this._onKMinus);
        this.game.inputManager.addMappedKeyDownListener(KeyInput.EDITOR_MOVE_FORWARD, this._onJPlus);
        this.game.inputManager.addMappedKeyDownListener(KeyInput.EDITOR_MOVE_BACKWARD, this._onJMinus);
        this.game.inputManager.addMappedKeyDownListener(KeyInput.EDITOR_ROTATE, this._onRPlus);
        this.game.inputManager.addMappedKeyDownListener(KeyInput.EDITOR_ROTATE_BACK, this._onRMinus);
        this.game.inputManager.addMappedKeyDownListener(KeyInput.EDITOR_DELETE, this._onDelete);
        this.game.inputManager.addMappedKeyDownListener(KeyInput.EDITOR_FOCUS_CAM, this._onFocus);
        document.body.addEventListener("pointerdown", this.pointerDown);
        document.body.addEventListener("pointermove", this.pointerMove);
        document.body.addEventListener("pointerup", this.pointerUp);
        if (this.game.mode === GameMode.Create) {
            this.editNameButton = document.querySelector("#machine-name .edit");
            this.editNameButton.style.display = "inline-block";
            this.editAuthorButton = document.querySelector("#machine-author .edit");
            this.editAuthorButton.style.display = "inline-block";
            this.editNameButton.onclick = () => {
                this.setSelectedObject(undefined);
                this.game.setEditMachineName(true);
            };
            this.editAuthorButton.onclick = () => {
                this.setSelectedObject(undefined);
                this.game.setEditMachineAuthor(true);
            };
            let editNameInput = document.querySelector("#machine-name-edit");
            editNameInput.onchange = () => {
                this.machine.name = editNameInput.value;
                this.game.setEditMachineName(false);
            };
            let editAuthorInput = document.querySelector("#machine-author-edit");
            editAuthorInput.onchange = () => {
                this.machine.author = editAuthorInput.value;
                this.game.setEditMachineAuthor(false);
            };
        }
        for (let i = 0; i < this.machine.balls.length; i++) {
            this.machine.balls[i].setShowPositionZeroGhost(true);
        }
        this._draggedEndpointOrigin = BABYLON.MeshBuilder.CreateSphere("dragged-endpoint-origin", { segments: 12, diameter: 0.005 });
        this._draggedEndpointOrigin.material = this.game.materials.whiteFullLitMaterial;
        this.dragAxises = [];
        let axisX = BABYLON.MeshBuilder.CreateCylinder("axisX", { height: 2, diameter: 0.001, tessellation: 6 });
        axisX.material = this.game.materials.whiteFullLitMaterial;
        axisX.rotation.z = Math.PI * 0.5;
        axisX.parent = this._draggedEndpointOrigin;
        this.dragAxises[DragAxises.AxisX] = axisX;
        let axisY = BABYLON.MeshBuilder.CreateCylinder("axisY", { height: 2, diameter: 0.001, tessellation: 6 });
        axisY.material = this.game.materials.whiteFullLitMaterial;
        axisY.parent = this._draggedEndpointOrigin;
        this.dragAxises[DragAxises.AxisY] = axisY;
        let axisZ = BABYLON.MeshBuilder.CreateCylinder("axisZ", { height: 2, diameter: 0.001, tessellation: 6 });
        axisZ.material = this.game.materials.whiteFullLitMaterial;
        axisZ.rotation.x = Math.PI * 0.5;
        axisZ.parent = this._draggedEndpointOrigin;
        this.dragAxises[DragAxises.AxisZ] = axisZ;
        let axisXZ = BABYLON.MeshBuilder.CreateCylinder("axisXZ", { height: 2, diameter: 0.001, tessellation: 6 });
        axisXZ.material = this.game.materials.whiteFullLitMaterial;
        axisXZ.rotation.x = Math.PI * 0.5;
        axisXZ.rotation.y = Math.PI * 0.25;
        axisXZ.parent = this._draggedEndpointOrigin;
        this.dragAxises[DragAxises.AxisXZ] = axisXZ;
        this.updateFloatingElements();
        this.inputEnabled = true;
        requestAnimationFrame(() => {
            this.game.topbar.resize();
        });
    }
    createHandles() {
        if (this.handlesContainer) {
            this.handlesContainer.dispose();
        }
        this.handlesContainer = new BABYLON.Mesh("handles-container");
        this.handlesContainer.rotationQuaternion = BABYLON.Quaternion.Identity();
        this.verticalHandle = new HeightArrow("vertical-handle");
        BABYLON.CreateSphereVertexData({ segments: 12, diameter: 0.03 }).applyToMesh(this.verticalHandle);
        this.verticalHandle.parent = this.handlesContainer;
        this.verticalHandle.material = this.game.materials.whiteFullLitMaterial;
        this.verticalHandle.renderOutline = true;
        this.verticalHandle.outlineWidth = 0.001;
        this.verticalHandle.outlineColor.copyFromFloats(1, 1, 1);
        this.turnLeftHandle = new BABYLON.Mesh("turn-left-handle");
        this.turnLeftHandle.parent = this.handlesContainer;
        this.turnLeftHandle.material = this.game.materials.whiteFullLitMaterial;
        this.turnLeftHandle.renderOutline = true;
        this.turnLeftHandle.outlineWidth = 0.001;
        this.turnLeftHandle.outlineColor.copyFromFloats(1, 1, 1);
        this.turnRightHandle = new BABYLON.Mesh("turn-right-handle");
        this.turnRightHandle.parent = this.handlesContainer;
        this.turnRightHandle.material = this.game.materials.whiteFullLitMaterial;
        this.turnRightHandle.renderOutline = true;
        this.turnRightHandle.outlineWidth = 0.001;
        this.turnRightHandle.outlineColor.copyFromFloats(1, 1, 1);
        this.turn2DHandle = new BABYLON.Mesh("turn-2D-handle");
        this.turn2DHandle.parent = this.handlesContainer;
        this.handles = [
            this.verticalHandle,
            this.turnLeftHandle,
            this.turnRightHandle,
            this.turn2DHandle
        ];
        this.handles.forEach(handle => {
            //handle.screenSize = this.game.config.getValue("handleSize") / 100;
        });
    }
    disposeHandles() {
        this.handles.forEach(handle => {
            handle.dispose();
        });
        this.handles = [];
    }
    _createButton(id, parent, spacer = false) {
        let button = document.createElement("button");
        if (id != "") {
            button.id = id;
        }
        button.classList.add("btn");
        button.classList.add("xs");
        if (spacer) {
            button.style.visibility = "hidden";
        }
        parent.appendChild(button);
        return button;
    }
    dispose() {
        this.container.style.display = "none";
        this.game.toolbar.container.classList.remove("machine-editor-1-line");
        this.game.toolbar.container.classList.remove("machine-editor-2-lines");
        this.hoveredObject = undefined;
        this.setSelectedObject(undefined);
        this.game.toolbar.resize();
        if (this.machinePartEditorMenu) {
            this.machinePartEditorMenu.dispose();
        }
        this.disposeHandles();
        this.endpointGizmoManager.clear();
        if (this.itemContainer) {
            this.itemContainer.innerHTML = "";
        }
        this.items = new Map();
        document.removeEventListener("keydown", this._onKeyDown);
        document.removeEventListener("keyup", this._onKeyUp);
        this.game.inputManager.removeMappedKeyDownListener(KeyInput.EDITOR_MOVE_RIGHT, this._onIPlus);
        this.game.inputManager.removeMappedKeyDownListener(KeyInput.EDITOR_MOVE_LEFT, this._onIMinus);
        this.game.inputManager.removeMappedKeyDownListener(KeyInput.EDITOR_MOVE_UP, this._onJMinus);
        this.game.inputManager.removeMappedKeyDownListener(KeyInput.EDITOR_MOVE_DOWN, this._onJPlus);
        this.game.inputManager.removeMappedKeyDownListener(KeyInput.EDITOR_MOVE_FORWARD, this._onKMinus);
        this.game.inputManager.removeMappedKeyDownListener(KeyInput.EDITOR_MOVE_BACKWARD, this._onKPlus);
        this.game.inputManager.removeMappedKeyDownListener(KeyInput.EDITOR_ROTATE, this._onRPlus);
        this.game.inputManager.removeMappedKeyDownListener(KeyInput.EDITOR_ROTATE_BACK, this._onRMinus);
        this.game.inputManager.removeMappedKeyDownListener(KeyInput.EDITOR_DELETE, this._onDelete);
        this.game.inputManager.removeMappedKeyDownListener(KeyInput.EDITOR_FOCUS_CAM, this._onFocus);
        document.body.removeEventListener("pointerdown", this.pointerDown);
        document.body.removeEventListener("pointermove", this.pointerMove);
        document.body.removeEventListener("pointerup", this.pointerUp);
        for (let i = 0; i < this.machine.balls.length; i++) {
            this.machine.balls[i].setShowPositionZeroGhost(false);
        }
        if (this.editNameButton) {
            this.editNameButton.style.display = "none";
        }
        if (this.editAuthorButton) {
            this.editAuthorButton.style.display = "none";
        }
        if (this._draggedEndpointOrigin) {
            this._draggedEndpointOrigin.dispose();
        }
    }
    update(dt) {
        let ratio = this.game.screenRatio;
        if (ratio > 1) {
            this.container.classList.add("left");
            this.container.classList.remove("bottom");
        }
        else {
            this.container.classList.add("bottom");
            this.container.classList.remove("left");
        }
        if (!IsTouchScreen) {
            let pickingRay = this.game.scene.createPickingRay(this.game.scene.pointerX * window.devicePixelRatio, this.game.scene.pointerY * window.devicePixelRatio, BABYLON.Matrix.Identity(), this.game.arcCamera, false);
            pickingRay.direction.normalize();
            let pick = this.game.scene.pickWithRay(pickingRay, (mesh) => {
                if (mesh instanceof Core.EndpointSelectorMesh && mesh.endpoint.machinePart === this.selectedObject) {
                    return true;
                }
                return false;
            });
            if (!pick.hit) {
                pick = this.game.scene.pickWithRay(pickingRay, (mesh) => {
                    if (mesh instanceof Core.BallGhost && mesh.ball === this.selectedObject) {
                        return true;
                    }
                    return false;
                });
            }
            if (!pick.hit) {
                pick = this.game.scene.pickWithRay(pickingRay, (mesh) => {
                    if (mesh instanceof Core.MachinePartSelectorMesh && mesh.part === this.selectedObject) {
                        return true;
                    }
                    return false;
                });
            }
            if (!pick.hit) {
                pick = this.game.scene.pickWithRay(pickingRay, (mesh) => {
                    if (!this.challengeMode && mesh instanceof Core.BallGhost) {
                        return true;
                    }
                    return false;
                });
            }
            if (!pick.hit) {
                pick = this.game.scene.pickWithRay(pickingRay, (mesh) => {
                    if (mesh instanceof Core.MachinePartSelectorMesh && mesh.part.isSelectable) {
                        return true;
                    }
                    if (mesh instanceof Core.EndpointSelectorMesh && mesh.isVisible && mesh.endpoint.machinePart.isSelectable) {
                        return true;
                    }
                    return false;
                });
            }
            if (pick.hit && pick.pickedMesh instanceof Core.BallGhost) {
                this.hoveredObject = pick.pickedMesh.ball;
            }
            else if (pick.hit && pick.pickedMesh instanceof Core.MachinePartSelectorMesh) {
                this.hoveredObject = pick.pickedMesh.part;
            }
            else if (pick.hit && pick.pickedMesh instanceof Core.EndpointSelectorMesh) {
                let machinePart = this.selectedObject;
                if (pick.pickedMesh.endpoint.machinePart === machinePart) {
                    this.hoveredObject = pick.pickedMesh.endpoint;
                }
                else {
                    this.hoveredObject = pick.pickedMesh.endpoint.machinePart;
                }
            }
            else {
                this.hoveredObject = undefined;
            }
        }
        if (this.draggedObject instanceof Core.MachinePart) {
            if (!this.draggedObject.isPlaced) {
                this.draggedObject.updateTargetCoordinates(dt);
                this.updateFloatingElements();
            }
        }
        if (this.handlesContainer && this.selectedObject instanceof Core.MachinePart) {
            if (this.is3DMode) {
                let f = Math.abs((this.game.arcCamera.beta - Math.PI / 2) / (Math.PI / 2));
                let camUp = this.game.arcCamera.getDirection(BABYLON.Axis.Y);
                let camForward = this.game.arcCamera.getDirection(BABYLON.Axis.Z);
                camUp.scaleInPlace(1 - f);
                camForward.scaleInPlace(f);
                let camDir = camUp.addInPlace(camForward);
                Mummu.QuaternionFromYZAxisToRef(BABYLON.Axis.Y, camDir, this.handlesContainer.rotationQuaternion);
            }
            if (this.machine.updatingMachinePartCoordinates) {
                this.updateFloatingElements();
            }
        }
        this.dragAxises.forEach(dragAxis => { dragAxis.isVisible = false; });
        if (this.draggedObject instanceof Core.MachinePartEndpoint) {
            let angularLimit = Math.PI / 12;
            let camDir = this._draggedEndpointOrigin.absolutePosition.subtract(this.game.arcCamera.globalPosition);
            let camDirFlat = camDir.clone();
            camDirFlat.y = 0;
            let zAxis = this.draggedObject.machinePart.getDirection(BABYLON.Axis.Z);
            let alphaAround = Math.abs(Mummu.AngleFromToAround(camDir, zAxis, BABYLON.Axis.Y));
            let betaAround = Mummu.Angle(camDir, camDirFlat);
            let canShowXAxis = this.draggedObject.machinePart.lExtendableOnX;
            let canShowYAxis = this.draggedObject.machinePart.hExtendableOnY;
            let canShowZAxis = this.mode === Core.MachineConstructionMode.Mode3D && (this.draggedObject.machinePart.lExtendableOnZ || this.draggedObject.machinePart.dExtendableOnZ);
            let canShowXZAxis = this.mode === Core.MachineConstructionMode.Mode3D && this.draggedObject.machinePart.lExtendableOnXZ;
            if (canShowXAxis) {
                if (Math.abs(alphaAround - Math.PI * 0.5) < angularLimit) {
                    if (betaAround < Math.PI * 0.25) {
                        canShowXAxis = false;
                    }
                    else {
                        canShowYAxis = false;
                    }
                }
            }
            if (canShowZAxis) {
                if (alphaAround < angularLimit || Math.abs(alphaAround - Math.PI) < angularLimit) {
                    if (betaAround < Math.PI * 0.25) {
                        canShowZAxis = false;
                    }
                    else {
                        canShowYAxis = false;
                    }
                }
            }
            if (canShowXZAxis) {
                if (Math.abs(alphaAround - Math.PI * 0.75) < angularLimit) {
                    if (betaAround < Math.PI * 0.25) {
                        canShowXZAxis = false;
                    }
                    else {
                        canShowYAxis = false;
                    }
                }
            }
            this._draggedEndpointOrigin;
            this._draggedEndpointOrigin.isVisible = true;
            if (canShowXAxis) {
                let angle = Mummu.Angle(camDir, this._draggedEndpointOrigin.getDirection(BABYLON.Axis.X));
                if (angle > angularLimit && angle < Math.PI - angularLimit) {
                    this.dragAxises[DragAxises.AxisX].isVisible = true;
                }
            }
            if (canShowYAxis) {
                let angle = Mummu.Angle(camDir, this._draggedEndpointOrigin.getDirection(BABYLON.Axis.Y));
                if (angle > angularLimit && angle < Math.PI - angularLimit) {
                    this.dragAxises[DragAxises.AxisY].isVisible = true;
                }
            }
            if (canShowZAxis) {
                let angle = Mummu.Angle(camDir, this._draggedEndpointOrigin.getDirection(BABYLON.Axis.Z));
                if (angle > angularLimit && angle < Math.PI - angularLimit) {
                    this.dragAxises[DragAxises.AxisZ].isVisible = true;
                }
            }
            if (canShowXZAxis) {
                let angle = Mummu.Angle(camDir, this._draggedEndpointOrigin.getDirection(new BABYLON.Vector3(1, 0, 1)));
                if (angle > angularLimit && angle < Math.PI - angularLimit) {
                    this.dragAxises[DragAxises.AxisXZ].isVisible = true;
                }
            }
        }
        else if (this._draggedEndpointOrigin) {
            this._draggedEndpointOrigin.isVisible = false;
        }
        this.endpointGizmoManager.update(dt);
        if (this.selectedObject instanceof Core.BlackBoard && this.drawBlackboardPath.length >= 2) {
            if (!this.drawBlackboardMesh) {
                this.drawBlackboardMesh = new BABYLON.Mesh("draw-blackboard-mesh");
                this.drawBlackboardMesh.material = this.game.materials.selectorFullLitLightBlueMaterial;
            }
            this.drawBlackboardMesh.isVisible = true;
            this.drawBlackboardMesh.position.copyFrom(this.selectedObject.position);
            let path = this.drawBlackboardPath;
            if (this.drawBlackboardCurrentPointer) {
                path = [...this.drawBlackboardPath, this.drawBlackboardCurrentPointer];
            }
            Mummu.CreateWireVertexData({ path: path, radius: 0.002 }).applyToMesh(this.drawBlackboardMesh, true);
        }
        else {
            if (this.drawBlackboardMesh) {
                this.drawBlackboardMesh.isVisible = false;
            }
        }
    }
    findClosestEndpointIndex(part, worldPos) {
        // find the closest endpoint and make it the dragged one.
        let bestEndpointIndex = -1;
        let bestSqrDist = Infinity;
        for (let i = 0; i < part.endPoints.length; i++) {
            let sqrDist = BABYLON.Vector3.DistanceSquared(worldPos, part.endPoints[i].absolutePosition);
            if (sqrDist < bestSqrDist) {
                bestSqrDist = sqrDist;
                bestEndpointIndex = i;
            }
        }
        return bestEndpointIndex;
    }
    async mirrorXTrackInPlace(track) {
        let mirroredTrack = this.machine.trackFactory.createTrack(track.partName, {
            i: track.i,
            j: track.j,
            k: track.k,
            r: track.r,
            c: track.colors,
            mirrorX: !track.mirrorX,
            mirrorZ: track.mirrorZ
        });
        mirroredTrack.onBeforeDelete = track.onBeforeDelete;
        track.dispose();
        this.machine.parts.push(mirroredTrack);
        mirroredTrack.setIsVisible(true);
        mirroredTrack.generateWires();
        await mirroredTrack.instantiate(true);
        mirroredTrack.recomputeAbsolutePath();
        return mirroredTrack;
    }
    async mirrorZTrackInPlace(track) {
        let mirroredTrack = this.machine.trackFactory.createTrack(track.partName, {
            i: track.i,
            j: track.j,
            k: track.k,
            r: track.r,
            c: track.colors,
            mirrorX: track.mirrorX,
            mirrorZ: !track.mirrorZ
        });
        mirroredTrack.onBeforeDelete = track.onBeforeDelete;
        track.dispose();
        this.machine.parts.push(mirroredTrack);
        mirroredTrack.setIsVisible(true);
        mirroredTrack.generateWires();
        await mirroredTrack.instantiate(true);
        mirroredTrack.recomputeAbsolutePath();
        return mirroredTrack;
    }
    updateFloatingElements() {
        if (this.handles.length === 0) {
            this.createHandles();
        }
        if (this.handles) {
            this.handles.forEach(handle => {
                handle.isVisible = false;
            });
        }
        if (this.selectedObject) {
            if (this.selectedObject instanceof Core.Ball) {
                if (this.mode === Core.MachineConstructionMode.Mode3D) {
                    this.verticalHandle.isVisible = true;
                    this.handlesContainer.position.copyFrom(this.selectedObject.positionZero);
                    this.verticalHandle.position.copyFromFloats(0, 2 * this.selectedObject.radius, 0);
                    let rFunc = f => {
                        if (f < 0.6) {
                            return 0.0025;
                        }
                        else {
                            f = (f - 0.6) / 0.4;
                            return 0.006 * (1 - f) + 0.0005 * f;
                        }
                    };
                    let y0 = 0;
                    let y1 = 0.015;
                    let verticalHandlePath = [];
                    for (let i = 0; i <= 10; i++) {
                        let f = i / 10;
                        let y = y0 * (1 - f) + y1 * f;
                        verticalHandlePath.push(new BABYLON.Vector3(0, y, 0));
                        if (i === 6) {
                            y += 0.0005;
                            verticalHandlePath.push(new BABYLON.Vector3(0, y, 0));
                        }
                    }
                    let verticalHandleVertexData = Mummu.CreateWireVertexData({ path: verticalHandlePath, pathUps: verticalHandlePath.map(() => { return BABYLON.Axis.Z; }), radiusFunc: rFunc, tesselation: 16, cap: BABYLON.Mesh.CAP_ALL });
                    Mummu.ColorizeVertexDataInPlace(verticalHandleVertexData, BABYLON.Color3.FromHexString("#264b96"));
                    verticalHandleVertexData.applyToMesh(this.verticalHandle);
                }
            }
            else if (this.selectedObject instanceof Core.MachinePart) {
                if (isFinite(this.selectedObject.targetR) && Mummu.IsFinite(this.selectedObject.targetUpdatePivot)) {
                    if (this.mode === Core.MachineConstructionMode.Mode3D) {
                        this.verticalHandle.isVisible = true;
                    }
                    this.turnLeftHandle.isVisible = true;
                    this.turnRightHandle.isVisible = true;
                }
                else if (this.selectedObjectsCount === 1) {
                    let pMin = this.selectedObject.worldAABBMin;
                    let pMax = this.selectedObject.worldAABBMax;
                    let w = pMax.x - pMin.x;
                    let h = pMax.y - pMin.y;
                    let d = pMax.z - pMin.z;
                    if (this.is3DMode) {
                        let center = this.selectedObject.localBarycenterIJK;
                        center = center.multiplyByFloats(Core.tileSize, Core.tileHeight, Core.tileSize);
                        center.y = this.selectedObject.localBarycenter.y;
                        BABYLON.Vector3.TransformCoordinatesToRef(center, this.selectedObject.getWorldMatrix(), this.handlesContainer.position);
                        let r = this.selectedObject.rAfterUpdate;
                        let wPair = this.selectedObject.visibleWidth % 2 === 0;
                        let dPair = this.selectedObject.visibleDepth % 2 === 0;
                        if (wPair && dPair) {
                            if (r === 0) {
                                this.handlesContainer.position.x += Core.tileSize * 0.5;
                                this.handlesContainer.position.z -= Core.tileSize * 0.5;
                            }
                            if (r === 1) {
                                this.handlesContainer.position.x += Core.tileSize * 0.5;
                                this.handlesContainer.position.z += Core.tileSize * 0.5;
                            }
                            if (r === 2) {
                                this.handlesContainer.position.x -= Core.tileSize * 0.5;
                                this.handlesContainer.position.z += Core.tileSize * 0.5;
                            }
                            if (r === 3) {
                                this.handlesContainer.position.x -= Core.tileSize * 0.5;
                                this.handlesContainer.position.z -= Core.tileSize * 0.5;
                            }
                        }
                        else if (wPair) {
                            if (r === 0) {
                                this.handlesContainer.position.x += Core.tileSize * 0.5 * 2;
                                //this.handlesContainer.position.z -= Core.tileSize * 0.5;
                            }
                            if (r === 1) {
                                //this.handlesContainer.position.x -= Core.tileSize * 0.5;
                                this.handlesContainer.position.z += Core.tileSize * 0.5 * 2;
                            }
                            if (r === 2) {
                                //this.handlesContainer.position.x -= Core.tileSize * 0.5;
                                //this.handlesContainer.position.z -= Core.tileSize * 0.5;
                            }
                            if (r === 3) {
                                //this.handlesContainer.position.x -= Core.tileSize * 0.5;
                                //this.handlesContainer.position.z -= Core.tileSize * 0.5;
                            }
                        }
                        else if (dPair) {
                            if (r === 0) {
                                this.handlesContainer.position.x += Core.tileSize * 0.5;
                                this.handlesContainer.position.z -= Core.tileSize * 0.5;
                            }
                            if (r === 1) {
                                this.handlesContainer.position.x += Core.tileSize * 0.5;
                                this.handlesContainer.position.z += Core.tileSize * 0.5;
                            }
                            if (r === 2) {
                                this.handlesContainer.position.x += Core.tileSize * 0.5;
                                this.handlesContainer.position.z += Core.tileSize * 0.5;
                            }
                            if (r === 3) {
                                this.handlesContainer.position.x -= Core.tileSize * 0.5;
                                this.handlesContainer.position.z += Core.tileSize * 0.5;
                            }
                        }
                        else {
                        }
                    }
                    else if (this.is2DMode) {
                        this.handlesContainer.position.copyFrom(this.selectedObject.localAABBMin).addInPlace(this.selectedObject.localAABBMax).scaleInPlace(0.5);
                        BABYLON.Vector3.TransformCoordinatesToRef(this.handlesContainer.position, this.selectedObject.getWorldMatrix(), this.handlesContainer.position);
                        this.handlesContainer.position.z = 0;
                    }
                    let radius = 0.25 * d + 0.25 * w + 0.03;
                    if (this.is2DMode) {
                        radius = 5 * Core.tileSize;
                    }
                    let rFunc = (f) => { return 1; };
                    if (this.is3DMode) {
                        rFunc = f => {
                            if (f < 0.6) {
                                return 0.005;
                            }
                            else {
                                f = (f - 0.6) / 0.4;
                                return 0.012 * (1 - f) + 0.001 * f;
                            }
                        };
                    }
                    else if (this.is2DMode) {
                        rFunc = f => {
                            if (f < 0.6) {
                                return 0.005;
                            }
                            else {
                                f = (f - 0.6) / 0.4;
                                return 0.012 * (1 - f) + 0.001 * f;
                            }
                        };
                    }
                    if (this.mode === Core.MachineConstructionMode.Mode3D) {
                        this.verticalHandle.position.copyFromFloats(0, 0.5 * h, 0);
                        let y0 = 0;
                        let y1 = 0.035;
                        let verticalHandlePath = [];
                        for (let i = 0; i <= 10; i++) {
                            let f = i / 10;
                            let y = y0 * (1 - f) + y1 * f;
                            verticalHandlePath.push(new BABYLON.Vector3(0, y, 0));
                        }
                        let verticalHandleVertexData = Mummu.CreateWireVertexData({ path: verticalHandlePath, pathUps: verticalHandlePath.map(() => { return BABYLON.Axis.Z; }), radiusFunc: rFunc, tesselation: 16, cap: BABYLON.Mesh.CAP_ALL });
                        Mummu.ColorizeVertexDataInPlace(verticalHandleVertexData, BABYLON.Color3.FromHexString("#264b96"));
                        verticalHandleVertexData.applyToMesh(this.verticalHandle);
                    }
                    let p = 2 * Math.PI * radius;
                    let a0 = 0;
                    let a1 = 1;
                    if (this.is3DMode) {
                        a0 = 0.015 / p * 2 * Math.PI;
                        a1 = 0.06 / p * 2 * Math.PI;
                    }
                    else if (this.is2DMode) {
                        a0 = 0.003 / p * 2 * Math.PI;
                        a1 = 0.04 / p * 2 * Math.PI;
                    }
                    let path = [];
                    for (let i = 0; i <= 10; i++) {
                        let f = i / 10;
                        let a = a0 * (1 - f) + a1 * f;
                        let x = Math.sin(a) * radius;
                        let z = -Math.cos(a) * radius;
                        path.push(new BABYLON.Vector3(x, 0, z));
                        if (i === 5) {
                            a += Math.PI / 100;
                            let x = Math.sin(a) * radius;
                            let z = -Math.cos(a) * radius;
                            path.push(new BABYLON.Vector3(x, 0, z));
                        }
                    }
                    let turnHandleVertexData = Mummu.CreateWireVertexData({ path: path, radiusFunc: rFunc, tesselation: 16, cap: BABYLON.Mesh.CAP_ALL });
                    Mummu.ColorizeVertexDataInPlace(turnHandleVertexData, BABYLON.Color3.FromHexString("#264b96"));
                    turnHandleVertexData.applyToMesh(this.turnRightHandle);
                    path.forEach(pt => {
                        pt.x = -pt.x;
                    });
                    Mummu.MirrorXVertexDataInPlace(turnHandleVertexData);
                    turnHandleVertexData.applyToMesh(this.turnLeftHandle);
                    if (this.is3DMode) {
                        this.turnRightHandle.position.copyFromFloats(0, -0.5 * h + 0.5 * Core.tileHeight, 0);
                        this.turnLeftHandle.position.copyFromFloats(0, -0.5 * h + 0.5 * Core.tileHeight, 0);
                    }
                    else if (this.is2DMode) {
                        BABYLON.CreateBoxVertexData({ width: 4 * Core.tileSize, height: 1.5 * Core.tileSize, depth: 1.5 * Core.tileSize }).applyToMesh(this.turn2DHandle);
                        this.turn2DHandle.isVisible = true;
                        this.turn2DHandle.visibility = 0;
                        let y = -0.5 * h - 0.75 * Core.tileHeight;
                        if (y + this.handlesContainer.position.y < Core.tileHeight * 0) {
                            y = Core.tileHeight * 0 - this.handlesContainer.position.y;
                        }
                        this.turnRightHandle.position.copyFromFloats(0, y, 5 * Core.tileSize);
                        this.turnLeftHandle.position.copyFromFloats(0, y, 5 * Core.tileSize);
                        this.turn2DHandle.position.copyFromFloats(0, y, 0);
                    }
                    if (this.mode === Core.MachineConstructionMode.Mode3D) {
                        this.verticalHandle.isVisible = true;
                    }
                    this.turnLeftHandle.isVisible = true;
                    this.turnRightHandle.isVisible = true;
                }
                else if (this.selectedObjectsCount > 1) {
                    let pMin = new BABYLON.Vector3(Infinity, Infinity, Infinity);
                    let pMax = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
                    this.selectedObjects.forEach(part => {
                        if (part instanceof Core.MachinePart) {
                            pMin.x = Math.min(part.worldAABBMin.x, pMin.x);
                            pMin.y = Math.min(part.localAABBMin.y + part.position.y, pMin.y);
                            pMin.z = Math.min(part.worldAABBMin.z, pMin.z);
                            pMax.x = Math.max(part.worldAABBMax.x, pMax.x);
                            pMax.y = Math.max(part.localAABBMax.y + part.position.y, pMax.y);
                            pMax.z = Math.max(part.worldAABBMax.z, pMax.z);
                        }
                    });
                    let w = pMax.x - pMin.x;
                    let h = pMax.y - pMin.y;
                    let d = pMax.z - pMin.z;
                    this.handlesContainer.position.copyFrom(pMax).addInPlace(pMin).scaleInPlace(0.5);
                    this.verticalHandle.position.copyFromFloats(0, 0.5 * h, 0);
                    let rFunc = f => {
                        if (f < 0.6) {
                            return 0.005;
                        }
                        else {
                            f = (f - 0.6) / 0.4;
                            return 0.012 * (1 - f) + 0.001 * f;
                        }
                    };
                    let y0 = 0;
                    let y1 = 0.035;
                    let verticalHandlePath = [];
                    for (let i = 0; i <= 10; i++) {
                        let f = i / 10;
                        let y = y0 * (1 - f) + y1 * f;
                        verticalHandlePath.push(new BABYLON.Vector3(0, y, 0));
                    }
                    let verticalHandleVertexData = Mummu.CreateWireVertexData({ path: verticalHandlePath, pathUps: verticalHandlePath.map(() => { return BABYLON.Axis.Z; }), radiusFunc: rFunc, tesselation: 16, cap: BABYLON.Mesh.CAP_ALL });
                    Mummu.ColorizeVertexDataInPlace(verticalHandleVertexData, BABYLON.Color3.FromHexString("#264b96"));
                    verticalHandleVertexData.applyToMesh(this.verticalHandle);
                    this.verticalHandle.isVisible = true;
                }
            }
        }
    }
    _updateBuildZoneLimits() {
        let margin = 0.5;
        this.buildZoneMin.copyFromFloats(-margin, 0, -margin);
        this.buildZoneMax.copyFromFloats(margin, margin, margin);
        for (let i = 0; i < this.machine.parts.length; i++) {
            let part = this.machine.parts[i];
            if (part != this.draggedObject) {
                if (this.selectedObjects.indexOf(part) === -1) {
                    this.buildZoneMin.x = Math.min(this.buildZoneMin.x, part.worldAABBMin.x - margin);
                    this.buildZoneMin.z = Math.min(this.buildZoneMin.z, part.worldAABBMin.z - margin);
                    this.buildZoneMax.x = Math.max(this.buildZoneMax.x, part.worldAABBMax.x + margin);
                    this.buildZoneMax.y = Math.max(this.buildZoneMax.y, part.worldAABBMax.y + margin);
                    this.buildZoneMax.z = Math.max(this.buildZoneMax.z, part.worldAABBMax.z + margin);
                }
            }
        }
        this.buildZoneCenter.copyFrom(this.buildZoneMin).addInPlace(this.buildZoneMax).scaleInPlace(0.5);
    }
    _isIntoBuildZone(p) {
        let cx = (this.buildZoneMin.x + this.buildZoneMax.x) * 0.5;
        let cz = (this.buildZoneMin.z + this.buildZoneMax.z) * 0.5;
        let w2 = (this.buildZoneMax.x - this.buildZoneMin.x) * 0.5;
        let d2 = (this.buildZoneMax.z - this.buildZoneMin.z) * 0.5;
        let dx = p.x - cx;
        dx = dx / w2;
        let dz = p.z - cz;
        dz = dz / d2;
        let l = Math.sqrt(dx * dx + dz * dz);
        if (l > 1) {
            return false;
        }
        else {
            return true;
        }
    }
    _clampIntoBuildZoneToRef(p, ref) {
        ref.y = Math.min(this.buildZoneMax.y, p.y);
        let cx = (this.buildZoneMin.x + this.buildZoneMax.x) * 0.5;
        let cz = (this.buildZoneMin.z + this.buildZoneMax.z) * 0.5;
        let w2 = (this.buildZoneMax.x - this.buildZoneMin.x) * 0.5;
        let d2 = (this.buildZoneMax.z - this.buildZoneMin.z) * 0.5;
        let dx = p.x - cx;
        dx = dx / w2;
        let dz = p.z - cz;
        dz = dz / d2;
        let l = Math.sqrt(dx * dx + dz * dz);
        if (l > 1) {
            dx /= l;
            dz /= l;
            ref.x = cx + dx * w2;
            ref.z = cz + dz * d2;
            return ref;
        }
        else {
            return ref;
        }
    }
}
function DEBUG_LOG_SELECTED_PART_NAMES() {
    let selectedPartNames = Game.Instance.machineEditor.selectedObjects.map(selectedObject => {
        if (selectedObject instanceof Core.MachinePart) {
            return selectedObject.partName + (selectedObject.mirrorX ? "_X" : "") + (selectedObject.mirrorZ ? "_Z" : "");
        }
        return "";
    });
    console.log(selectedPartNames);
}
function colorizeEntireMachine(machine, color) {
    for (let i = 0; i < machine.parts.length; i++) {
        let part = machine.parts[i];
        part.colors[0] = color;
        if (part instanceof Core.Shooter || part instanceof Core.Elevator) {
            part.colors[1] = color;
        }
    }
}
async function editTrackInPlace(track, props, checkBlocks) {
    let machine = track.machine;
    if (!props) {
        props = {};
    }
    if (!isFinite(props.i)) {
        props.i = track.i;
    }
    if (!isFinite(props.j)) {
        props.j = track.j;
    }
    if (!isFinite(props.k)) {
        props.k = track.k;
    }
    if (!isFinite(props.r)) {
        props.r = track.r;
    }
    if (!isFinite(props.l)) {
        props.l = track.w;
    }
    if (!isFinite(props.h)) {
        props.h = track.h;
    }
    if (!isFinite(props.d)) {
        props.d = track.d;
    }
    if (!isFinite(props.n)) {
        props.n = track.n;
    }
    if (!isFinite(props.s)) {
        props.s = track.s;
    }
    if (!props.c && !(track.colors.length === 1 && track.colors[0] === 0)) {
        props.c = track.colors;
    }
    props.mirrorX = track.mirrorX;
    props.mirrorZ = track.mirrorZ;
    let editedTrack = machine.trackFactory.createTrackWHDN(track.partName, props);
    if (checkBlocks) {
        await editedTrack.instantiate(false);
        if (editedTrack.intersectsAnyBlock()) {
            editedTrack.dispose();
            return track;
        }
    }
    editedTrack.onBeforeDelete = track.onBeforeDelete;
    track.dispose();
    machine.parts.push(editedTrack);
    editedTrack.setIsVisible(true);
    await editedTrack.instantiate(true);
    machine.generateBaseMesh();
    return editedTrack;
}
async function addToTrackLengthInPlace(track, dLength, axis, isOrigin) {
    let alongX = axis.x === 1;
    let newI = track.i;
    let newJ = track.j;
    if (isOrigin && track.l > 0) {
        dLength = -dLength;
        let worldAxis = track.getDirection(axis);
        newI -= dLength * worldAxis.x;
        newJ -= dLength * worldAxis.z;
    }
    else if (isOrigin && track.l < 0) {
        dLength = -dLength;
        if (!alongX) {
            let worldAxis = track.getDirection(axis);
            newI -= dLength * worldAxis.x;
            newJ -= dLength * worldAxis.z;
        }
    }
    else if (!isOrigin && track.l < 0) {
        if (alongX) {
            let worldAxis = track.getDirection(axis);
            newI += dLength * worldAxis.x;
            newJ += dLength * worldAxis.z;
        }
    }
    else {
    }
    let newL = track.l + dLength;
    if (newL * track.l < 0) {
        if (alongX) {
            let worldAxis = track.getDirection(axis);
            newI -= worldAxis.x;
            newJ -= worldAxis.z;
        }
    }
    if (newL >= track.minW && newL <= track.maxW && Math.abs(newL) >= track.minLAbsolute) {
        let editedTrack = await editTrackInPlace(track, { i: newI, j: newJ, l: newL }, true);
        return editedTrack;
    }
    return track;
}
async function addToTrackHeightInPlace(track, dHeight, isOrigin, downward) {
    let newK = track.k;
    if (isOrigin && !downward) {
        dHeight = -dHeight;
        newK -= dHeight;
    }
    else if (isOrigin && downward) {
        newK += dHeight;
    }
    else if (!isOrigin && downward) {
        dHeight = -dHeight;
    }
    let newH = track.h + dHeight;
    if (newK >= 0 && newK + newH >= 0 || track.k < 0) {
        if (newH >= track.minH && newH <= track.maxH) {
            let editedTrack = await editTrackInPlace(track, { k: newK, h: newH }, true);
            return editedTrack;
        }
    }
    return track;
}
async function addToTrackDepthInPlace(track, dDepth, axis, isOrigin) {
    let newI = track.i;
    let newJ = track.j;
    if (isOrigin) {
        dDepth = -dDepth;
        let worldAxis = track.getDirection(axis);
        newI -= dDepth * worldAxis.x;
        newJ -= dDepth * worldAxis.z;
    }
    let newD = track.d + dDepth;
    if (newD >= track.minD && newD <= track.maxD && Math.abs(newD) >= track.minDAbsolute) {
        let editedTrack = await editTrackInPlace(track, { i: newI, j: newJ, d: newD }, true);
        return editedTrack;
    }
    return track;
}
var EndpointGizmoMode;
(function (EndpointGizmoMode) {
    EndpointGizmoMode[EndpointGizmoMode["Idle"] = 0] = "Idle";
    EndpointGizmoMode[EndpointGizmoMode["Connnecting"] = 1] = "Connnecting";
})(EndpointGizmoMode || (EndpointGizmoMode = {}));
class EndpointGizmo extends BABYLON.Mesh {
    constructor(endpoint, manager) {
        super("endpoint-gizmo");
        this.endpoint = endpoint;
        this.manager = manager;
        this.animationMode = EndpointGizmoMode.Idle;
        this.position.copyFrom(endpoint.absolutePosition);
        this.material = endpoint.machinePart.game.materials.whiteFullLitMaterial;
        this.alphaIndex = 1;
    }
    instantiate() {
        let data = BABYLON.CreateCylinderVertexData({ height: 0.01, tessellation: 10, diameter: 0.02 });
        Mummu.RotateAngleAxisVertexDataInPlace(data, Math.PI * 0.5, BABYLON.Axis.Z);
        Mummu.TranslateVertexDataInPlace(data, new BABYLON.Vector3(this.endpoint.leftSide ? 0.02 : -0.02, 0, 0));
        Mummu.ColorizeVertexDataInPlace(data, BABYLON.Color3.FromHexString("#80FFFF"));
        if (!this.isDisposed()) {
            data.applyToMesh(this);
        }
    }
    update() {
        if (this.animationMode === EndpointGizmoMode.Connnecting) {
            let sign = this.endpoint.leftSide ? 1 : -1;
            let fPos = this.manager.connectAnimationTimer * 4 / 3;
            fPos = Nabu.MinMax(fPos, 0, 1);
            this.position.copyFrom(this.endpoint.absolutePosition);
            this.position.x -= sign * Nabu.Easing.easeOutCubic(fPos) * 0.015;
            let fAlpha = this.manager.connectAnimationTimer;
            if (fAlpha < 0.2) {
                this.visibility = Nabu.Easing.easeInOutSine(fAlpha / 0.25) * 0.3;
            }
            else if (fAlpha < 0.6) {
                this.visibility = 0.3;
            }
            else if (fAlpha < 0.8) {
                let fAlpha2 = Nabu.Easing.easeInOutSine((fAlpha - 0.6) / 0.2);
                this.visibility = 0.3 * (1 - fAlpha2) + 0.7 * fAlpha2;
            }
            else {
                let fAlpha2 = Nabu.Easing.easeInOutSine((fAlpha - 0.8) / 0.2);
                this.visibility = 0.7 * (1 - fAlpha2) + 0 * fAlpha2;
            }
        }
    }
}
class EndpointGizmoManager {
    constructor(machineEditor) {
        this.machineEditor = machineEditor;
        this.showAvailableEndpoints = false;
        this.availableEndpointsGizmos = [];
        this.connectAnimationTimer = 0;
    }
    clear() {
        if (this.aimedGizmo) {
            this.aimedGizmo.dispose();
            this.aimedGizmo = undefined;
        }
    }
    update(dt) {
        this.connectAnimationTimer += dt * 0.7;
        while (this.connectAnimationTimer > 1) {
            this.connectAnimationTimer -= 1;
        }
        let displayEndpointGizmo = false;
        if (this.machineEditor.aimedEndpoint) {
            if (this.machineEditor.selectedEndpoint) {
                if (this.machineEditor.aimedEndpoint.leftSide != this.machineEditor.selectedEndpoint.leftSide) {
                    if (BABYLON.Vector3.DistanceSquared(this.machineEditor.aimedEndpoint.absolutePosition, this.machineEditor.selectedEndpoint.absolutePosition) < 0.001 * 0.001) {
                        displayEndpointGizmo = true;
                    }
                }
            }
        }
        if (this.aimedGizmo && this.aimedGizmo.endpoint != this.machineEditor.aimedEndpoint) {
            this.aimedGizmo.dispose();
            this.aimedGizmo = undefined;
        }
        if (displayEndpointGizmo && !this.aimedGizmo) {
            this.aimedGizmo = new EndpointGizmo(this.machineEditor.aimedEndpoint, this);
            this.aimedGizmo.animationMode = EndpointGizmoMode.Connnecting;
            this.aimedGizmo.instantiate();
        }
        else if (!displayEndpointGizmo && this.aimedGizmo) {
            this.aimedGizmo.dispose();
            this.aimedGizmo = undefined;
        }
        if (this.aimedGizmo) {
            this.aimedGizmo.animationMode = EndpointGizmoMode.Connnecting;
            this.aimedGizmo.update();
        }
        let layers = [];
        if (this.machineEditor.selectedObject instanceof Core.MachinePart) {
            for (let i = 0; i < this.machineEditor.selectedObject.endPoints.length; i++) {
                let endpoint = this.machineEditor.selectedObject.endPoints[i];
                layers.push(endpoint.absolutePosition.y);
            }
        }
        for (let i = 0; i < this.machineEditor.machine.parts.length; i++) {
            let part = this.machineEditor.machine.parts[i];
            for (let j = 0; j < part.endPoints.length; j++) {
                let endpoint = part.endPoints[j];
                if ((this.machineEditor.draggedObject || this.showAvailableEndpoints) &&
                    !endpoint.connectedEndPoint &&
                    endpoint != this.machineEditor.aimedEndpoint &&
                    (this.machineEditor.selectedObjects.indexOf(endpoint.machinePart) === -1)) {
                    let layerIndex = layers.findIndex((layer) => {
                        return Math.abs(endpoint.absolutePosition.y - layer) < 0.001;
                    });
                    if (layerIndex != -1) {
                        endpoint.showHelperMesh();
                        let layer = layers[layerIndex];
                        let originLayer = layers[0];
                        endpoint.updateHelperMesh(0, Math.sign(layer - originLayer), this.connectAnimationTimer);
                    }
                    else {
                        endpoint.hideHelperMesh();
                    }
                }
                else {
                    endpoint.hideHelperMesh();
                }
            }
        }
    }
}
class MachineEditorGrid extends BABYLON.Mesh {
    constructor(editor) {
        super("machine-editor-grid");
        this.editor = editor;
        this._lastSelectedObjectsCount = 0;
        this._lastSelectedObjectPosition = BABYLON.Vector3.Zero();
        this.collisionPlane = BABYLON.MeshBuilder.CreateGround("machine-editor-grid-plane", { width: 100, height: 100 });
        this.collisionPlane.parent = this;
        this.collisionPlane.visibility = 0;
        //this.collisionPlane.isVisible = false;
        let count = 20;
        let color = new BABYLON.Color4(1, 1, 1, 0.2);
        let colors = [];
        for (let j = -count; j <= count; j++) {
            colors.push([color, color]);
        }
        for (let k = -count; k <= count; k++) {
            colors.push([color, color]);
        }
        let yLines = [];
        for (let i = -count; i <= count; i++) {
            yLines.push([
                new BABYLON.Vector3(i * Core.tileSize - 0.5 * Core.tileSize, 0, -count * Core.tileSize),
                new BABYLON.Vector3(i * Core.tileSize - 0.5 * Core.tileSize, 0, count * Core.tileSize),
            ]);
        }
        for (let k = -count; k <= count; k++) {
            yLines.push([
                new BABYLON.Vector3(-count * Core.tileSize - 0.5 * Core.tileSize, 0, k * Core.tileSize - 0.5 * Core.tileSize),
                new BABYLON.Vector3(count * Core.tileSize - 0.5 * Core.tileSize, 0, k * Core.tileSize - 0.5 * Core.tileSize),
            ]);
        }
        this.yGrid = BABYLON.MeshBuilder.CreateLineSystem("machine-editor-y-grid", { lines: yLines, colors: colors }, editor.game.scene);
        this.yGrid.parent = this;
        this.yGrid.isVisible = false;
    }
    setPosition(position) {
        return;
        this.position.copyFrom(position);
    }
    update() {
        let selectedObjectPosition;
        if (this.editor.selectedObject) {
            if (this.editor.selectedObject instanceof Core.Ball) {
                if (!this.editor.draggedObject) {
                    selectedObjectPosition = this.editor.selectedObject.positionZero.add(new BABYLON.Vector3(0, -this.editor.selectedObject.radius, 0));
                }
            }
            else {
                selectedObjectPosition = this.editor.selectedObject.position;
                if (this.editor.draggedObject) {
                    if (this.editor.draggedObject instanceof Core.MachinePartEndpoint) {
                        selectedObjectPosition = this.editor.draggedObject.absolutePosition;
                    }
                }
            }
        }
        if (this.editor.selectedObjectsCount != this._lastSelectedObjectsCount ||
            this.editor.selectedObject != this._lastSelectedObject ||
            selectedObjectPosition && BABYLON.Vector3.Distance(selectedObjectPosition, this._lastSelectedObjectPosition) > 0.001) {
            if (selectedObjectPosition) {
                this.position.y = selectedObjectPosition.y;
                this.isVisible = true;
            }
            else {
                this.isVisible = false;
            }
            this.yGrid.isVisible = this.isVisible;
            this.yGrid.isVisible = false;
            let worldEncloseStart = new BABYLON.Vector3(Infinity, -Infinity, -Infinity);
            let worldEncloseEnd = new BABYLON.Vector3(-Infinity, Infinity, Infinity);
            if (this.editor.selectedObjects.length > 0) {
                this.editor.selectedObjects.forEach(obj => {
                    if (obj instanceof Core.MachinePart) {
                        worldEncloseStart.x = Math.min(worldEncloseStart.x, obj.position.x + obj.encloseStart.x);
                        worldEncloseStart.y = Math.max(worldEncloseStart.y, obj.position.y + obj.encloseStart.y);
                        worldEncloseStart.z = Math.max(worldEncloseStart.z, obj.position.z + obj.encloseStart.z);
                        worldEncloseEnd.x = Math.max(worldEncloseEnd.x, obj.position.x + obj.encloseEnd.x);
                        worldEncloseEnd.y = Math.min(worldEncloseEnd.y, obj.position.y + obj.encloseEnd.y);
                        worldEncloseEnd.z = Math.min(worldEncloseEnd.z, obj.position.z + obj.encloseEnd.z);
                    }
                });
            }
            /*
            for (let i = 0; i < this.editor.machine.parts.length; i++) {
                let part = this.editor.machine.parts[i];
                let showGridRect = false;
                if (!part.selected && this.isVisible) {
                    for (let j = 0; j < part.endPoints.length; j++) {
                        let endpoint = part.endPoints[j];
                        if (Math.abs(endpoint.absolutePosition.y - this.position.y) < 0.001) {
                            showGridRect = true;
                        }
                    }
                }
                if (showGridRect) {
                    part.gridRectMesh.parent = undefined;
                    part.gridRectMesh.position.copyFrom(part.position);
                    part.gridRectMesh.position.y = this.position.y;
                    part.gridRectMesh.rotation.copyFrom(part.rotation);
                    part.gridRectMesh.isVisible = true;
                }
                else if (!part.selected) {
                    part.gridRectMesh.parent = part;
                    part.gridRectMesh.position.copyFromFloats(0, 0, 0);
                    part.gridRectMesh.isVisible = false;
                }
            }
                */
            this._lastSelectedObjectsCount = this.editor.selectedObjects.length;
            this._lastSelectedObject = this.editor.selectedObject;
            if (selectedObjectPosition) {
                this._lastSelectedObjectPosition.copyFrom(selectedObjectPosition);
            }
        }
    }
}
var MachineMode;
(function (MachineMode) {
    MachineMode[MachineMode["Only3D"] = 1] = "Only3D";
    MachineMode[MachineMode["Only2D"] = 2] = "Only2D";
    MachineMode[MachineMode["AllD"] = 3] = "AllD";
})(MachineMode || (MachineMode = {}));
var MachineEditorPartsList = [
    { part: "ramp_3.0.0", mode: MachineMode.AllD },
    { part: "wave_6.0.0", mode: MachineMode.AllD },
    { part: "snake_9.1", mode: MachineMode.AllD },
    { part: "join", mode: MachineMode.AllD },
    { part: "flatjoin", mode: MachineMode.AllD },
    { part: "tjoin", mode: MachineMode.Only3D },
    { part: "multiJoin_2", mode: MachineMode.Only3D },
    { part: "cross2d", mode: MachineMode.AllD },
    { part: "split", mode: MachineMode.AllD },
    { part: "sort", mode: MachineMode.AllD },
    { part: "forwardSplit", mode: MachineMode.Only3D },
    { part: "tsplit", mode: MachineMode.Only3D },
    { part: "controler", mode: MachineMode.Only3D },
    { part: "curb_3.0", mode: MachineMode.Only3D },
    { part: "uturn_3.0", mode: MachineMode.Only3D },
    { part: "uturnsharp_2", mode: MachineMode.AllD },
    { part: "teardropTurn_1", mode: MachineMode.AllD },
    { part: "piperamp_3.0.0", mode: MachineMode.AllD },
    { part: "pipeuturn_3.0", mode: MachineMode.Only3D },
    { part: "pipecurb_3.0", mode: MachineMode.Only3D },
    { part: "pipeuturnsharp_2", mode: MachineMode.AllD },
    { part: "pipeloop_6.1.1", mode: MachineMode.Only3D },
    { part: "pipeloop_5.0.1", mode: MachineMode.Only2D },
    { part: "pipeunderloop_6.1.1", mode: MachineMode.Only3D },
    { part: "pipeunderloop_5.0.1", mode: MachineMode.Only2D },
    //{ part: "woodstart_1", mode: MachineMode.AllD},
    //{ part: "woodramp_6.0.0.0.1", mode: MachineMode.AllD},
    //{ part: "woodcurb_4.0.0.1", mode: MachineMode.Only3D },
    //{ part: "woodramp_8.-1.0.1.2", mode: MachineMode.AllD},
    //{ part: "woodcurb_7.-1.1.2", mode: MachineMode.Only3D },
    { part: "wall_3.3", mode: MachineMode.Only3D },
    { part: "loop_6.1.1", mode: MachineMode.Only3D },
    { part: "loop_5.0.1", mode: MachineMode.Only2D },
    { part: "spiral_3.3", mode: MachineMode.AllD },
    { part: "ladder_4.4", mode: MachineMode.AllD },
    { part: "spiralUTurn_3.3", mode: MachineMode.Only3D },
    { part: "dropside_1", mode: MachineMode.Only3D },
    { part: "dropback_1", mode: MachineMode.AllD },
    { part: "elevator_4", mode: MachineMode.AllD },
    { part: "shooter_8", mode: MachineMode.AllD },
    { part: "stairway_6.2", mode: MachineMode.AllD },
    { part: "screw_6.2", mode: MachineMode.AllD },
    { part: "speeder_3", mode: MachineMode.AllD },
    { part: "gravitywell", mode: MachineMode.Only3D },
    { part: "coil_5.3", mode: MachineMode.Only3D },
    { part: "screen", mode: MachineMode.Only3D },
    { part: "start", mode: MachineMode.AllD },
    { part: "end", mode: MachineMode.AllD },
    { part: "jumper_1", mode: MachineMode.AllD },
];
var MachineEditorNewPartsList = [];
var MachineEditorAdLockedPartsList = [];
var MachineEditorPartsListDebug = [
    { part: "blackboard_16.16.1", mode: MachineMode.Only2D },
    { part: "box_2.2", mode: MachineMode.Only2D },
    { part: "diamond_2", mode: MachineMode.Only2D },
    { part: "bumper_2", mode: MachineMode.Only2D },
    { part: "endbasket", mode: MachineMode.Only2D },
    { part: "largesplit", mode: MachineMode.Only2D },
    { part: "star", mode: MachineMode.Only2D },
    { part: "wooduturn_3.0" },
    { part: "spawner" },
    { part: "trikeSkull" },
    { part: "bitsplit", mode: MachineMode.AllD },
];
var MachineEditorDisplayNames = [
    { partName: "ramp", displayName: "坡道" },
    { partName: "wave", displayName: "波浪軌道" },
    { partName: "snake", displayName: "蛇形軌道" },
    { partName: "join", displayName: "連接" },
    { partName: "flatjoin", displayName: "平直連接" },
    { partName: "split", displayName: "分流" },
    { partName: "sort", displayName: "分類" },
    { partName: "forwardSplit", displayName: "前置分流" },
    { partName: "uturn", displayName: "U 型轉彎" },
    { partName: "uturnsharp", displayName: "U 型直立" },
    { partName: "wall", displayName: "牆壁" },
    { partName: "loop", displayName: "迴圈" },
    { partName: "spiral", displayName: "螺旋" },
    { partName: "spiralUTurn", displayName: "螺旋 U 型轉彎" },
    { partName: "coil", displayName: "盤繞" },
    { partName: "elevator", displayName: "升降機" },
    { partName: "stairway", displayName: "階梯" },
    { partName: "screw", displayName: "螺旋桿" },
    { partName: "start", displayName: "起點" },
    { partName: "end", displayName: "終點" },
    { partName: "blackboard", displayName: "畫板" },
    { partName: "jumper", displayName: "跳躍器" },
    { partName: "gravitywell", displayName: "重力井" },
    { partName: "shooter", displayName: "發射器" },
    { partName: "controler", displayName: "控制器" },
    { partName: "spawner", displayName: "生成器" },
    { partName: "screen", displayName: "螢幕" },
    { partName: "speeder", displayName: "加速器" },
    { partName: "ladder", displayName: "梯子" },
    { partName: "teardropTurn", displayName: "水滴轉彎" },
    { partName: "tsplit", displayName: "T 型分流" },
    { partName: "tjoin", displayName: "T 型連接" },
    { partName: "cross2d", displayName: "十字路口" },
    { partName: "dropside", displayName: "下降導流" },
    { partName: "dropback", displayName: "下降轉彎" },
    { partName: "curb", displayName: "導流護欄" },
    { partName: "piperamp", displayName: "管道" },
    { partName: "pipeuturn", displayName: "管道 U 型轉彎" },
    { partName: "pipecurb", displayName: "管道導流" },
    { partName: "pipeuturnsharp", displayName: "管道 U 型直立" },
    { partName: "pipeloop", displayName: "管道迴圈" },
    { partName: "pipeunderloop", displayName: "倒置管道迴圈" },
    { partName: "multiJoin", displayName: "多向連接" },
    { partName: "piperamp", displayName: "管道" },
    { partName: "woodramp", displayName: "賽道" },
    { partName: "woodcurb", displayName: "賽道護欄" },
];
var MachineEditorTutorialPartColor = [
    { partName: "elevator", colors: [5, 5] },
    { partName: "join", colors: [5, 5, 5] },
    { partName: "flatjoin", colors: [5, 5, 5] },
    { partName: "split", colors: [5, 5, 5, 5, 1] },
    { partName: "default", colors: [5] },
];
var MachineEditorPartColors = [
    { colorName: "鋼鐵", index: 0 },
    { colorName: "黃銅", index: 1 },
    { colorName: "銅", index: 15 },
    { colorName: "白色（金屬）", index: 17 },
    { colorName: "黑色（金屬）", index: 2 },
    { colorName: "紅色（金屬）", index: 3 },
    { colorName: "黃色（金屬）", index: 16 },
    { colorName: "綠色（金屬）", index: 4 },
    { colorName: "藍色（金屬）", index: 5 },
    { colorName: "黑色（塑膠）", index: 6 },
    { colorName: "白色（塑膠）", index: 18 },
    { colorName: "紅色（塑膠）", index: 7 },
    { colorName: "橙色（塑膠）", index: 8 },
    { colorName: "黃色（塑膠）", index: 9 },
    { colorName: "綠色（塑膠）", index: 10 },
    { colorName: "青色（塑膠）", index: 11 },
    { colorName: "藍色（塑膠）", index: 12 },
    { colorName: "紫色（塑膠）", index: 13 },
    { colorName: "粉紅（塑膠）", index: 14 },
];
var MachineEditorBallColors = [
    { colorName: "鋼鐵", index: 0 },
    { colorName: "黃銅", index: 1 },
    { colorName: "銅", index: 9 },
    { colorName: "白色（金屬）", index: 10 },
    { colorName: "黑色（金屬）", index: 11 },
    { colorName: "紅色（金屬）", index: 12 },
    { colorName: "黃色（金屬）", index: 13 },
    { colorName: "綠色（金屬）", index: 14 },
    { colorName: "藍色（金屬）", index: 15 },
    { colorName: "黑色（塑膠）", index: 16 },
    { colorName: "紅色（塑膠）", index: 17 },
    { colorName: "橙色（塑膠）", index: 18 },
    { colorName: "黃色（塑膠）", index: 19 },
    { colorName: "綠色（塑膠）", index: 20 },
    { colorName: "青色（塑膠）", index: 21 },
    { colorName: "藍色（塑膠）", index: 22 },
    { colorName: "紫色（塑膠）", index: 23 },
    { colorName: "粉紅（塑膠）", index: 24 },
    { colorName: "方形", index: 2 },
    { colorName: "圓形", index: 3 },
    { colorName: "星星", index: 4 },
    { colorName: "Tiaratum", index: 5 },
    { colorName: "HTML5", index: 6 },
    { colorName: "Tiaratum", index: 7 },
    { colorName: "Poki", index: 8 },
];
var MachineEditorRooms = [
    { roomName: "博物館", index: 0 },
    { roomName: "寧靜", index: 9 },
    { roomName: "湛藍", index: 13 },
    { roomName: "峭壁", index: 14 },
    { roomName: "河流", index: 15 },
    { roomName: "簡約", index: 11 },
    { roomName: "黑色", index: 12 },
    { roomName: "泡泡糖", index: 2 },
    { roomName: "靈異", index: 3 },
    { roomName: "葉綠", index: 4 },
    { roomName: "科學", index: 5 }
];
function RandomMachineEditorRoomIndex() {
    let r = Math.random();
    if (r < 1 / 3) {
        return 13;
    }
    else if (r < 2 / 3) {
        return 14;
    }
    else {
        return 15;
    }
}
var ExistingCountryFlags = [
    {
        code: "un",
        name: "聯合國",
        c1: "#4b92db",
        c2: "#fff"
    },
    {
        code: "xx",
        name: "未知/未公開",
        c1: "#fff",
        c2: "#adb5bd"
    },
    {
        code: "af",
        name: "Afghanistan",
        c1: "#bf0000",
        c2: "#000001",
        c3: "#090"
    },
    {
        code: "ax",
        name: "Aland Islands",
        c1: "#0053a5",
        c2: "#ffce00",
        c3: "#d21034"
    },
    {
        code: "al",
        name: "Albania",
        c1: "red",
        c2: "#000001"
    },
    {
        code: "dz",
        name: "Algeria",
        c1: "#fff",
        c2: "#006233",
        c3: "#d21034"
    },
    {
        code: "as",
        name: "American Samoa",
        c1: "#006",
        c2: "#fff",
        c3: "#bd1021"
    },
    {
        code: "ad",
        name: "Andorra",
        c1: "#fedf00",
        c2: "#0018a8",
        c3: "#d0103a"
    },
    {
        code: "ao",
        name: "Angola",
        c1: "#000001",
        c2: "red",
        c3: "#ffec00"
    },
    {
        code: "ai",
        name: "Anguilla",
        c1: "#012169",
        c2: "#fff",
        c3: "#c8102e"
    },
    {
        code: "aq",
        name: "Antarctica",
        c1: "#3a7dce",
        c2: "#ffffff"
    },
    {
        code: "ag",
        name: "Antigua and Barbuda",
        c1: "#ce1126",
        c2: "#000001",
        c3: "#0072c6"
    },
    {
        code: "ar",
        name: "Argentina",
        c1: "#74acdf",
        c2: "#ffffff",
        c3: "#f6b40e"
    },
    {
        code: "am",
        name: "Armenia",
        c1: "#0033a0",
        c2: "#f2a800",
        c3: "#d90012"
    },
    {
        code: "aw",
        name: "Aruba",
        c1: "#3399cc",
        c2: "#ffff00",
        c3: "#cc0000"
    },
    {
        code: "sh-ac",
        name: "Ascension Island",
        c1: "#012169",
        c2: "#ffffff",
        c3: "#c8102e"
    },
    {
        code: "au",
        name: "Australia",
        c1: "#00008b",
        c2: "#ffffff",
        c3: "#ff0000"
    },
    {
        code: "at",
        name: "Austria",
        c1: "#c8102e",
        c2: "#ffffff"
    },
    {
        code: "az",
        name: "Azerbaijan",
        c1: "#3f9c35",
        c2: "#00b9e4",
        c3: "#ed2939"
    },
    {
        code: "bs",
        name: "Bahamas",
        c1: "#08ced6",
        c2: "#000001",
        c3: "#ffe900"
    },
    {
        code: "bh",
        name: "Bahrain",
        c1: "#ce1126",
        c2: "#ffffff"
    },
    {
        code: "bd",
        name: "Bangladesh",
        c1: "#006a4e",
        c2: "#f42a41"
    },
    {
        code: "bb",
        name: "Barbados",
        c1: "#00267f",
        c2: "#ffc726",
        c3: "#000001"
    },
    {
        code: "es-pv",
        name: "Basque Country",
        c1: "#d52b1e",
        c2: "#009b48",
        c3: "#ffffff"
    },
    {
        code: "by",
        name: "Belarus",
        c1: "#ce1720",
        c2: "#007c30",
        c3: "#ffffff"
    },
    {
        code: "be",
        name: "Belgium",
        c1: "#ffd90c",
        c2: "#000001",
        c3: "#f31830"
    },
    {
        code: "bz",
        name: "Belize",
        c1: "#003f87",
        c2: "#ffffff",
        c3: "#ce1126"
    },
    {
        code: "bj",
        name: "Benin",
        c1: "#319400",
        c2: "#ffd600",
        c3: "#de2110"
    },
    {
        code: "bm",
        name: "Bermuda",
        c1: "#cf142b",
        c2: "#ffffff",
        c3: "#c8102e"
    },
    {
        code: "bt",
        name: "Bhutan",
        c1: "#ffd520",
        c2: "#ff4e12",
        c3: "#ffffff"
    },
    {
        code: "bo",
        name: "Bolivia",
        c1: "#d52b1e",
        c2: "#007934",
        c3: "#ffe000"
    },
    {
        code: "bq",
        name: "Bonaire, Sint Eustatius and Saba",
        c1: "#ffffff",
        c2: "#21468b",
        c3: "#ae1c28"
    },
    {
        code: "ba",
        name: "Bosnia and Herzegovina",
        c1: "#000099",
        c2: "#ffcc00",
        c3: "#ffffff"
    },
    {
        code: "bw",
        name: "Botswana",
        c1: "#00cbff",
        c2: "#000001",
        c3: "#ffffff"
    },
    {
        code: "bv",
        name: "Bouvet Island",
        c1: "#d72828",
        c2: "#003897",
        c3: "#ffffff"
    },
    {
        code: "br",
        name: "Brazil",
        c1: "#229e45",
        c2: "#f8e509",
        c3: "#2b49a3"
    },
    {
        code: "io",
        name: "British Indian Ocean Territory",
        c1: "#ffffff",
        c2: "#000063",
        c3: "#c8102e"
    },
    {
        code: "bn",
        name: "Brunei Darussalam",
        c1: "#f7e017",
        c2: "#ffffff",
        c3: "#000001"
    },
    {
        code: "bg",
        name: "Bulgaria",
        c1: "#00966e",
        c2: "#d62612",
        c3: "#ffffff"
    },
    {
        code: "bf",
        name: "Burkina Faso",
        c1: "#de0000",
        c2: "#35a100",
        c3: "#fff300"
    },
    {
        code: "bi",
        name: "Burundi",
        c1: "#ffffff",
        c2: "#cf0921",
        c3: "#18b637"
    },
    {
        code: "cv",
        name: "Cabo Verde",
        c1: "#081873",
        c2: "#ffffff",
        c3: "#de3929"
    },
    {
        code: "kh",
        name: "Cambodia",
        c1: "#032ea1",
        c2: "#e00025",
        c3: "#ffffff"
    },
    {
        code: "cm",
        name: "Cameroon",
        c1: "#fcd116",
        c2: "#007a5e",
        c3: "#ce1126"
    },
    {
        code: "ca",
        name: "Canada",
        c1: "#d52b1e",
        c2: "#ffffff"
    },
    {
        code: "ic",
        name: "Canary Islands",
        c1: "#0768a9",
        c2: "#ffffff",
        c3: "#ffcc00"
    },
    {
        code: "es-ct",
        name: "Catalonia",
        c1: "#fcdd09",
        c2: "#da121a"
    },
    {
        code: "ky",
        name: "Cayman Islands",
        c1: "#000066",
        c2: "#ffffff",
        c3: "#c8102e"
    },
    {
        code: "cf",
        name: "Central African Republic",
        c1: "#ffff00",
        c2: "#009a00",
        c3: "#ffffff"
    },
    {
        code: "td",
        name: "Chad",
        c1: "#c60c30",
        c2: "#002664",
        c3: "#fecb00"
    },
    {
        code: "cl",
        name: "Chile",
        c1: "#d52b1e",
        c2: "#ffffff",
        c3: "#0039a6"
    },
    {
        code: "cn",
        name: "China",
        c1: "#ee1c25",
        c2: "#ffff00"
    },
    {
        code: "cx",
        name: "Christmas Island",
        c1: "#0021ad",
        c2: "#1c8a42",
        c3: "#ffc639"
    },
    {
        code: "cp",
        name: "Clipperton Island",
        c1: "#ffffff",
        c2: "#000091",
        c3: "#e1000f"
    },
    {
        code: "cc",
        name: "Cocos (Keeling) Islands",
        c1: "#008000",
        c2: "#ffe000",
        c3: "#7b3100"
    },
    {
        code: "co",
        name: "Colombia",
        c1: "#ffe800",
        c2: "#00148e",
        c3: "#da0010"
    },
    {
        code: "km",
        name: "Comoros",
        c1: "#239e46",
        c2: "#3b5aa3",
        c3: "#ffff00"
    },
    {
        code: "ck",
        name: "Cook Islands",
        c1: "#000066",
        c2: "#ffffff",
        c3: "#c8102e"
    },
    {
        code: "cr",
        name: "Costa Rica",
        c1: "#ffffff",
        c2: "#d90000",
        c3: "#0000b4"
    },
    {
        code: "hr",
        name: "Croatia",
        c1: "#ff0000",
        c2: "#171796",
        c3: "#ffffff"
    },
    {
        code: "cu",
        name: "Cuba",
        c1: "#002a8f",
        c2: "#cb1515",
        c3: "#ffffff"
    },
    {
        code: "cw",
        name: "Curaçao",
        c1: "#002b7f",
        c2: "#f9e814",
        c3: "#ffffff"
    },
    {
        code: "cy",
        name: "Cyprus",
        c1: "#ffffff",
        c2: "#d47600",
        c3: "#435125"
    },
    {
        code: "cz",
        name: "Czech Republic",
        c1: "#d7141a",
        c2: "#ffffff",
        c3: "#11457e"
    },
    {
        code: "ci",
        name: "Côte d'Ivoire",
        c1: "#ffffff",
        c2: "#ff9a00",
        c3: "#00cd00"
    },
    {
        code: "cd",
        name: "Democratic Republic of the Congo",
        c1: "#007fff",
        c2: "#ce1021",
        c3: "#f7d618"
    },
    {
        code: "dk",
        name: "Denmark",
        c1: "#c8102e",
        c2: "#ffffff"
    },
    {
        code: "dg",
        name: "Diego Garcia",
        c1: "#ffffff",
        c2: "#000063",
        c3: "#c8102e"
    },
    {
        code: "dj",
        name: "Djibouti",
        c1: "#6699ff",
        c2: "#00cc00",
        c3: "#fffefe"
    },
    {
        code: "dm",
        name: "Dominica",
        c1: "#108c00",
        c2: "#e72910",
        c3: "#ffffff"
    },
    {
        code: "do",
        name: "Dominican Republic",
        c1: "#002d62",
        c2: "#ce1126",
        c3: "#ffffff"
    },
    {
        code: "ec",
        name: "Ecuador",
        c1: "#ffe800",
        c2: "#da0010",
        c3: "#00148e"
    },
    {
        code: "eg",
        name: "Egypt",
        c1: "#000001",
        c2: "#ce1126",
        c3: "#ffffff"
    },
    {
        code: "sv",
        name: "El Salvador",
        c1: "#0f47af",
        c2: "#ffffff",
        c3: "#1f601a"
    },
    {
        code: "gb-eng",
        name: "England",
        c1: "#ffffff",
        c2: "#ce1124"
    },
    {
        code: "gq",
        name: "Equatorial Guinea",
        c1: "#3e9a00",
        c2: "#e32118",
        c3: "#ffffff"
    },
    {
        code: "er",
        name: "Eritrea",
        c1: "#be0027",
        c2: "#239e46",
        c3: "#b4d7f4"
    },
    {
        code: "ee",
        name: "Estonia",
        c1: "#000001",
        c2: "#ffffff",
        c3: "#1791ff"
    },
    {
        code: "sz",
        name: "Eswatini",
        c1: "#3e5eb9",
        c2: "#b10c0c",
        c3: "#ffd900"
    },
    {
        code: "et",
        name: "Ethiopia",
        c1: "#298c08",
        c2: "#ef2118",
        c3: "#ffc621"
    },
    {
        code: "eu",
        name: "Europe",
        c1: "#003399",
        c2: "#ffcc00"
    },
    {
        code: "fk",
        name: "Falkland Islands",
        c1: "#012169",
        c2: "#ffffff",
        c3: "#c8102e"
    },
    {
        code: "fo",
        name: "Faroe Islands",
        c1: "#ffffff",
        c2: "#d72828",
        c3: "#003897"
    },
    {
        code: "fm",
        name: "Federated States of Micronesia",
        c1: "#6797d6",
        c2: "#ffffff"
    },
    {
        code: "fj",
        name: "Fiji",
        c1: "#68bfe5",
        c2: "#ffffff",
        c3: "#c8102e"
    },
    {
        code: "fi",
        name: "Finland",
        c1: "#ffffff",
        c2: "#002f6c"
    },
    {
        code: "fr",
        name: "France",
        c1: "#fff",
        c2: "#000091",
        c3: "#e1000f"
    },
    {
        code: "gf",
        name: "French Guiana",
        c1: "#ffffff",
        c2: "#000091",
        c3: "#e1000f"
    },
    {
        code: "pf",
        name: "French Polynesia",
        c1: "#de2010",
        c2: "#ffffff",
        c3: "#ef7d08"
    },
    {
        code: "tf",
        name: "French Southern Territories",
        c1: "#002395",
        c2: "#ffffff",
        c3: "#ed2939"
    },
    {
        code: "ga",
        name: "Gabon",
        c1: "#ffe700",
        c2: "#006dbc",
        c3: "#36a100"
    },
    {
        code: "es-ga",
        name: "Galicia",
        c1: "#ffffff",
        c2: "#0099cc",
        c3: "#005bbf"
    },
    {
        code: "gm",
        name: "Gambia",
        c1: "#000099",
        c2: "#009900",
        c3: "#ff0000"
    },
    {
        code: "ge",
        name: "Georgia",
        c1: "#ffffff",
        c2: "#ff0000"
    },
    {
        code: "de",
        name: "Germany",
        c1: "#ff0000",
        c2: "#ffcc00",
        c3: "#000001"
    },
    {
        code: "gh",
        name: "Ghana",
        c1: "#006b3f",
        c2: "#ce1126",
        c3: "#fcd116"
    },
    {
        code: "gi",
        name: "Gibraltar",
        c1: "#ffffff",
        c2: "#da000c",
        c3: "#000001"
    },
    {
        code: "gr",
        name: "Greece",
        c1: "#0d5eaf",
        c2: "#ffffff"
    },
    {
        code: "gl",
        name: "Greenland",
        c1: "#d00c33",
        c2: "#ffffff"
    },
    {
        code: "gd",
        name: "Grenada",
        c1: "#ce1126",
        c2: "#fcd116",
        c3: "#007a5e"
    },
    {
        code: "gp",
        name: "Guadeloupe",
        c1: "#ffffff",
        c2: "#000091",
        c3: "#e1000f"
    },
    {
        code: "gu",
        name: "Guam",
        c1: "#3b5aa3",
        c2: "#be0027",
        c3: "#cbe0e5"
    },
    {
        code: "gt",
        name: "Guatemala",
        c1: "#4997d0",
        c2: "#ffffff",
        c3: "#f9f0aa"
    },
    {
        code: "gg",
        name: "Guernsey",
        c1: "#ffffff",
        c2: "#e8112d",
        c3: "#f9dd16"
    },
    {
        code: "gn",
        name: "Guinea",
        c1: "#ffff00",
        c2: "#ff0000",
        c3: "#009900"
    },
    {
        code: "gw",
        name: "Guinea-Bissau",
        c1: "#fcd116",
        c2: "#009e49",
        c3: "#ce1126"
    },
    {
        code: "gy",
        name: "Guyana",
        c1: "#399408",
        c2: "#de2110",
        c3: "#ffde08"
    },
    {
        code: "ht",
        name: "Haiti",
        c1: "#d21034",
        c2: "#00209f",
        c3: "#ffffff"
    },
    {
        code: "hm",
        name: "Heard Island and McDonald Islands",
        c1: "#00008b",
        c2: "#ffffff",
        c3: "#ff0000"
    },
    {
        code: "va",
        name: "Holy See",
        c1: "#ffe000",
        c2: "#ffffff",
        c3: "#ce9d09"
    },
    {
        code: "hn",
        name: "Honduras",
        c1: "#18c3df",
        c2: "#ffffff"
    },
    {
        code: "hk",
        name: "Hong Kong",
        c1: "#ec1b2e",
        c2: "#ffffff"
    },
    {
        code: "hu",
        name: "Hungary",
        c1: "#ffffff",
        c2: "#388d00",
        c3: "#d43516"
    },
    {
        code: "is",
        name: "Iceland",
        c1: "#003897",
        c2: "#d72828",
        c3: "#ffffff"
    },
    {
        code: "in",
        name: "India",
        c1: "#128807",
        c2: "#ff9933",
        c3: "#ffffff"
    },
    {
        code: "id",
        name: "Indonesia",
        c1: "#e70011",
        c2: "#ffffff"
    },
    {
        code: "ir",
        name: "Iran",
        c1: "#ffffff",
        c2: "#da0000",
        c3: "#239f40"
    },
    {
        code: "iq",
        name: "Iraq",
        c1: "#000001",
        c2: "#ce1126",
        c3: "#ffffff"
    },
    {
        code: "ie",
        name: "Ireland",
        c1: "#ffffff",
        c2: "#009a49",
        c3: "#ff7900"
    },
    {
        code: "im",
        name: "Isle of Man",
        c1: "#ba0000",
        c2: "#ffffff",
        c3: "#000000"
    },
    {
        code: "il",
        name: "Israel",
        c1: "#ffffff",
        c2: "#0038b8"
    },
    {
        code: "it",
        name: "Italy",
        c1: "#ffffff",
        c2: "#009246",
        c3: "#ce2b37"
    },
    {
        code: "jm",
        name: "Jamaica",
        c1: "#ffcc00",
        c2: "#009900",
        c3: "#000001"
    },
    {
        code: "jp",
        name: "Japan",
        c1: "#ffffff",
        c2: "#bc002d"
    },
    {
        code: "je",
        name: "Jersey",
        c1: "#ffffff",
        c2: "#cf142b",
        c3: "#ffd700"
    },
    {
        code: "jo",
        name: "Jordan",
        c1: "#ff0000",
        c2: "#009900",
        c3: "#000001"
    },
    {
        code: "kz",
        name: "Kazakhstan",
        c1: "#00abc2",
        c2: "#ffec2d"
    },
    {
        code: "ke",
        name: "Kenya",
        c1: "#bb0000",
        c2: "#006600",
        c3: "#000001"
    },
    {
        code: "ki",
        name: "Kiribati",
        c1: "#e73e2d",
        c2: "#005989",
        c3: "#ffffff"
    },
    {
        code: "xk",
        name: "Kosovo",
        c1: "#244aa5",
        c2: "#d0a650",
        c3: "#ffffff"
    },
    {
        code: "kw",
        name: "Kuwait",
        c1: "#00d941",
        c2: "#f31830",
        c3: "#000001"
    },
    {
        code: "kg",
        name: "Kyrgyzstan",
        c1: "#ff0000",
        c2: "#ffff00"
    },
    {
        code: "la",
        name: "Laos",
        c1: "#ce1126",
        c2: "#002868",
        c3: "#ffffff"
    },
    {
        code: "lv",
        name: "Latvia",
        c1: "#981e32",
        c2: "#ffffff"
    },
    {
        code: "lb",
        name: "Lebanon",
        c1: "#ee161f",
        c2: "#ffffff",
        c3: "#00a850"
    },
    {
        code: "ls",
        name: "Lesotho",
        c1: "#ffffff",
        c2: "#009543",
        c3: "#00209f"
    },
    {
        code: "lr",
        name: "Liberia",
        c1: "#cc0000",
        c2: "#ffffff",
        c3: "#000066"
    },
    {
        code: "ly",
        name: "Libya",
        c1: "#000001",
        c2: "#239e46",
        c3: "#e70013"
    },
    {
        code: "li",
        name: "Liechtenstein",
        c1: "#ce1126",
        c2: "#002b7f",
        c3: "#ffd83d"
    },
    {
        code: "lt",
        name: "Lithuania",
        c1: "#006a44",
        c2: "#c1272d",
        c3: "#fdb913"
    },
    {
        code: "lu",
        name: "Luxembourg",
        c1: "#ffffff",
        c2: "#00a1de",
        c3: "#ed2939"
    },
    {
        code: "mo",
        name: "Macau",
        c1: "#00785e",
        c2: "#ffffff",
        c3: "#fbd116"
    },
    {
        code: "mg",
        name: "Madagascar",
        c1: "#fc3d32",
        c2: "#007e3a",
        c3: "#ffffff"
    },
    {
        code: "mw",
        name: "Malawi",
        c1: "#f41408",
        c2: "#21873b",
        c3: "#000001"
    },
    {
        code: "my",
        name: "Malaysia",
        c1: "#cc0000",
        c2: "#ffffff",
        c3: "#000066"
    },
    {
        code: "mv",
        name: "Maldives",
        c1: "#d21034",
        c2: "#007e3a",
        c3: "#ffffff"
    },
    {
        code: "ml",
        name: "Mali",
        c1: "#ffff00",
        c2: "#009a00",
        c3: "#ff0000"
    },
    {
        code: "mt",
        name: "Malta",
        c1: "#cf142b",
        c2: "#ffffff",
        c3: "#000000"
    },
    {
        code: "mh",
        name: "Marshall Islands",
        c1: "#3b5aa3",
        c2: "#ffffff",
        c3: "#e2ae57"
    },
    {
        code: "mq",
        name: "Martinique",
        c1: "#231f1e",
        c2: "#00a650",
        c3: "#ef1923"
    },
    {
        code: "mr",
        name: "Mauritania",
        c1: "#006233",
        c2: "#cd2a3e",
        c3: "#ffc400"
    },
    {
        code: "mu",
        name: "Mauritius",
        c1: "#151f6d",
        c2: "#ffcd00",
        c3: "#00a04d"
    },
    {
        code: "yt",
        name: "Mayotte",
        c1: "#ffffff",
        c2: "#000091",
        c3: "#e1000f"
    },
    {
        code: "mx",
        name: "Mexico",
        c1: "#006847",
        c2: "#ce1126",
        c3: "#ffffff"
    },
    {
        code: "md",
        name: "Moldova",
        c1: "#de2110",
        c2: "#00319c",
        c3: "#ffde00"
    },
    {
        code: "mc",
        name: "Monaco",
        c1: "#f31830",
        c2: "#ffffff"
    },
    {
        code: "mn",
        name: "Mongolia",
        c1: "#da2032",
        c2: "#0066b3",
        c3: "#ffd900"
    },
    {
        code: "me",
        name: "Montenegro",
        c1: "#c40308",
        c2: "#d3ae3b",
        c3: "#d4af3a"
    },
    {
        code: "ms",
        name: "Montserrat",
        c1: "#012169",
        c2: "#c8102e",
        c3: "#ffffff"
    },
    {
        code: "ma",
        name: "Morocco",
        c1: "#c1272d",
        c2: "#006233"
    },
    {
        code: "mz",
        name: "Mozambique",
        c1: "#ffca00",
        c2: "#009a00",
        c3: "#ff0000"
    },
    {
        code: "mm",
        name: "Myanmar",
        c1: "#fecb00",
        c2: "#ea2839",
        c3: "#34b233"
    },
    {
        code: "na",
        name: "Namibia",
        c1: "#c70000",
        c2: "#38a100",
        c3: "#3662a2"
    },
    {
        code: "nr",
        name: "Nauru",
        c1: "#002170",
        c2: "#ffb20d",
        c3: "#ffffff"
    },
    {
        code: "np",
        name: "Nepal",
        c1: "#ce0000",
        c2: "#000063",
        c3: "#ffffff"
    },
    {
        code: "nl",
        name: "Netherlands",
        c1: "#ffffff",
        c2: "#21468b",
        c3: "#ae1c28"
    },
    {
        code: "nc",
        name: "New Caledonia",
        c1: "#009543",
        c2: "#0035ad",
        c3: "#fae600"
    },
    {
        code: "nz",
        name: "New Zealand",
        c1: "#00247d",
        c2: "#c8102e",
        c3: "#ffffff"
    },
    {
        code: "ni",
        name: "Nicaragua",
        c1: "#0067c6",
        c2: "#ffffff",
        c3: "#c6cb24"
    },
    {
        code: "ne",
        name: "Niger",
        c1: "#e05206",
        c2: "#0db02b",
        c3: "#ffffff"
    },
    {
        code: "ng",
        name: "Nigeria",
        c1: "#008753",
        c2: "#ffffff"
    },
    {
        code: "nu",
        name: "Niue",
        c1: "#fedd00",
        c2: "#ffffff",
        c3: "#c8102e"
    },
    {
        code: "nf",
        name: "Norfolk Island",
        c1: "#198200",
        c2: "#ffffff",
        c3: "#000000"
    },
    {
        code: "kp",
        name: "North Korea",
        c1: "#c60000",
        c2: "#3e5698",
        c3: "#ffffff"
    },
    {
        code: "mk",
        name: "North Macedonia",
        c1: "#d20000",
        c2: "#ffe600"
    },
    {
        code: "gb-nir",
        name: "Northern Ireland",
        c1: "#ffffff",
        c2: "#cc0000",
        c3: "#ffcc00"
    },
    {
        code: "mp",
        name: "Northern Mariana Islands",
        c1: "#0071bc",
        c2: "#ffffff",
        c3: "#8c8a8c"
    },
    {
        code: "no",
        name: "Norway",
        c1: "#ed2939",
        c2: "#002664",
        c3: "#ffffff"
    },
    {
        code: "om",
        name: "Oman",
        c1: "#ef2d29",
        c2: "#ffffff",
        c3: "#009025"
    },
    {
        code: "pc",
        name: "Pacific Community",
        c1: "#003da5",
        c2: "#00aec7",
        c3: "#ffffff"
    },
    {
        code: "pk",
        name: "Pakistan",
        c1: "#0c590b",
        c2: "#ffffff"
    },
    {
        code: "pw",
        name: "Palau",
        c1: "#4aadd6",
        c2: "#ffde00"
    },
    {
        code: "ps",
        name: "Palestine",
        c1: "#009639",
        c2: "#ed2e38",
        c3: "#ffffff"
    },
    {
        code: "pa",
        name: "Panama",
        c1: "#ffffff",
        c2: "#0000ab",
        c3: "#db0000"
    },
    {
        code: "pg",
        name: "Papua New Guinea",
        c1: "#000001",
        c2: "#ff0000",
        c3: "#ffcc00"
    },
    {
        code: "py",
        name: "Paraguay",
        c1: "#d52b1e",
        c2: "#0038a8",
        c3: "#ffffff"
    },
    {
        code: "pe",
        name: "Peru",
        c1: "#d91023",
        c2: "#ffffff"
    },
    {
        code: "ph",
        name: "Philippines",
        c1: "#0038a8",
        c2: "#ce1126",
        c3: "#ffffff"
    },
    {
        code: "pn",
        name: "Pitcairn",
        c1: "#00247d",
        c2: "#c8102e",
        c3: "#ffffff"
    },
    {
        code: "pl",
        name: "Poland",
        c1: "#ffffff",
        c2: "#dc143c"
    },
    {
        code: "pt",
        name: "Portugal",
        c1: "#ff0000",
        c2: "#006600",
        c3: "#ffff00"
    },
    {
        code: "pr",
        name: "Puerto Rico",
        c1: "#ed0000",
        c2: "#0050f0",
        c3: "#ffffff"
    },
    {
        code: "qa",
        name: "Qatar",
        c1: "#8d1b3d",
        c2: "#ffffff"
    },
    {
        code: "cg",
        name: "Republic of the Congo",
        c1: "#ffff00",
        c2: "#00ca00",
        c3: "#ff0000"
    },
    {
        code: "ro",
        name: "Romania",
        c1: "#ffde00",
        c2: "#00319c",
        c3: "#de2110"
    },
    {
        code: "ru",
        name: "Russia",
        c1: "#0039a6",
        c2: "#d52b1e",
        c3: "#ffffff"
    },
    {
        code: "rw",
        name: "Rwanda",
        c1: "#00a1de",
        c2: "#20603d",
        c3: "#fad201"
    },
    {
        code: "re",
        name: "Réunion",
        c1: "#ffffff",
        c2: "#000091",
        c3: "#e1000f"
    },
    {
        code: "bl",
        name: "Saint Barthélemy",
        c1: "#ffffff",
        c2: "#000091",
        c3: "#e1000f"
    },
    {
        code: "sh-hl",
        name: "Saint Helena",
        c1: "#000066",
        c2: "#c8102e",
        c3: "#ffffff"
    },
    {
        code: "sh",
        name: "Saint Helena, Ascension and Tristan da Cunha",
        c1: "#c8102e",
        c2: "#ffffff",
        c3: "#012169"
    },
    {
        code: "kn",
        name: "Saint Kitts and Nevis",
        c1: "#000001",
        c2: "#c70000",
        c3: "#35a100"
    },
    {
        code: "lc",
        name: "Saint Lucia",
        c1: "#65cfff",
        c2: "#ffce00",
        c3: "#000001"
    },
    {
        code: "mf",
        name: "Saint Martin",
        c1: "#ffffff",
        c2: "#000091",
        c3: "#e1000f"
    },
    {
        code: "pm",
        name: "Saint Pierre and Miquelon",
        c1: "#ffffff",
        c2: "#000091",
        c3: "#e1000f"
    },
    {
        code: "vc",
        name: "Saint Vincent and the Grenadines",
        c1: "#f4f100",
        c2: "#199a00",
        c3: "#0058aa"
    },
    {
        code: "ws",
        name: "Samoa",
        c1: "#ce1126",
        c2: "#002b7f",
        c3: "#ffffff"
    },
    {
        code: "sm",
        name: "San Marino",
        c1: "#ffffff",
        c2: "#19b6ef",
        c3: "#65c7ff"
    },
    {
        code: "st",
        name: "Sao Tome and Principe",
        c1: "#12ad2b",
        c2: "#ffce00",
        c3: "#d21034"
    },
    {
        code: "sa",
        name: "Saudi Arabia",
        c1: "#165d31",
        c2: "#ffffff"
    },
    {
        code: "gb-sct",
        name: "Scotland",
        c1: "#0065bd",
        c2: "#ffffff"
    },
    {
        code: "sn",
        name: "Senegal",
        c1: "#0b7226",
        c2: "#bc0000",
        c3: "#ffff00"
    },
    {
        code: "rs",
        name: "Serbia",
        c1: "#ffffff",
        c2: "#c6363c",
        c3: "#0c4076"
    },
    {
        code: "sc",
        name: "Seychelles",
        c1: "#d92223",
        c2: "#007a39",
        c3: "#fcd955"
    },
    {
        code: "sl",
        name: "Sierra Leone",
        c1: "#00cd00",
        c2: "#0000cd",
        c3: "#ffffff"
    },
    {
        code: "sg",
        name: "Singapore",
        c1: "#ffffff",
        c2: "#df0000"
    },
    {
        code: "sx",
        name: "Sint Maarten",
        c1: "#ed2939",
        c2: "#002395",
        c3: "#ffffff"
    },
    {
        code: "sk",
        name: "Slovakia",
        c1: "#ee1c25",
        c2: "#ffffff",
        c3: "#0b4ea2"
    },
    {
        code: "si",
        name: "Slovenia",
        c1: "#0000bf",
        c2: "#d50000",
        c3: "#ffffff"
    },
    {
        code: "sb",
        name: "Solomon Islands",
        c1: "#0000d6",
        c2: "#006000",
        c3: "#ffcc00"
    },
    {
        code: "so",
        name: "Somalia",
        c1: "#40a6ff",
        c2: "#ffffff"
    },
    {
        code: "za",
        name: "South Africa",
        c1: "#007847",
        c2: "#e1392d",
        c3: "#000c8a"
    },
    {
        code: "gs",
        name: "South Georgia and the South Sandwich Islands",
        c1: "#000066",
        c2: "#c8102e",
        c3: "#ffffff"
    },
    {
        code: "kr",
        name: "South Korea",
        c1: "#ffffff",
        c2: "#000001",
        c3: "#cd2e3a"
    },
    {
        code: "ss",
        name: "South Sudan",
        c1: "#0f47af",
        c2: "#078930",
        c3: "#000001"
    },
    {
        code: "es",
        name: "Spain",
        c1: "#aa151b",
        c2: "#f1bf00",
        c3: "#c8b100"
    },
    {
        code: "lk",
        name: "Sri Lanka",
        c1: "#8d2029",
        c2: "#ffb700",
        c3: "#ff5b00"
    },
    {
        code: "sd",
        name: "Sudan",
        c1: "#000001",
        c2: "#ff0000",
        c3: "#009a00"
    },
    {
        code: "sr",
        name: "Suriname",
        c1: "#377e3f",
        c2: "#b40a2d",
        c3: "#ffffff"
    },
    {
        code: "sj",
        name: "Svalbard and Jan Mayen",
        c1: "#ef2b2d",
        c2: "#002868",
        c3: "#ffffff"
    },
    {
        code: "se",
        name: "Sweden",
        c1: "#005293",
        c2: "#fecb00"
    },
    {
        code: "ch",
        name: "Switzerland",
        c1: "#ff0000",
        c2: "#ffffff"
    },
    {
        code: "sy",
        name: "Syria",
        c1: "#007a3d",
        c2: "#ffffff",
        c3: "#ce1126"
    },
    {
        code: "tw",
        name: "Taiwan",
        c1: "#ff0000",
        c2: "#000095",
        c3: "#ffffff"
    },
    {
        code: "tj",
        name: "Tajikistan",
        c1: "#ffffff",
        c2: "#006600",
        c3: "#cc0000"
    },
    {
        code: "tz",
        name: "Tanzania",
        c1: "#000001",
        c2: "#009900",
        c3: "#0099ff"
    },
    {
        code: "th",
        name: "Thailand",
        c1: "#a51931",
        c2: "#2d2a4a",
        c3: "#f4f5f8"
    },
    {
        code: "tb",
        name: "Tibet",
        c1: "#29166f",
        c2: "#da251c",
        c3: "#f4e109"
    },
    {
        code: "tl",
        name: "Timor-Leste",
        c1: "#cb000f",
        c2: "#000001",
        c3: "#f8c00c"
    },
    {
        code: "tg",
        name: "Togo",
        c1: "#118600",
        c2: "#ffe300",
        c3: "#d80000"
    },
    {
        code: "tk",
        name: "Tokelau",
        c1: "#00247d",
        c2: "#fed100",
        c3: "#ffffff"
    },
    {
        code: "to",
        name: "Tonga",
        c1: "#c10000",
        c2: "#ffffff"
    },
    {
        code: "tt",
        name: "Trinidad and Tobago",
        c1: "#e00000",
        c2: "#000001",
        c3: "#ffffff"
    },
    {
        code: "sh-ta",
        name: "Tristan da Cunha",
        c1: "#000066",
        c2: "#c8102e",
        c3: "#ffffff"
    },
    {
        code: "tn",
        name: "Tunisia",
        c1: "#e70013",
        c2: "#ffffff"
    },
    {
        code: "tm",
        name: "Turkmenistan",
        c1: "#00843d",
        c2: "#d22630",
        c3: "#ffc72c"
    },
    {
        code: "tc",
        name: "Turks and Caicos Islands",
        c1: "#002868",
        c2: "#c8102e",
        c3: "#ffffff"
    },
    {
        code: "tv",
        name: "Tuvalu",
        c1: "#009fca",
        c2: "#c8102e",
        c3: "#ffffff"
    },
    {
        code: "tr",
        name: "Türkiye",
        c1: "#e30a17",
        c2: "#ffffff"
    },
    {
        code: "ug",
        name: "Uganda",
        c1: "#ffe700",
        c2: "#000001",
        c3: "#de3908"
    },
    {
        code: "ua",
        name: "Ukraine",
        c1: "#0057b8",
        c2: "#ffd700"
    },
    {
        code: "ae",
        name: "United Arab Emirates",
        c1: "#ff0000",
        c2: "#ffffff",
        c3: "#000001"
    },
    {
        code: "gb",
        name: "United Kingdom",
        c1: "#c8102e",
        c2: "#ffffff",
        c3: "#012169"
    },
    {
        code: "um",
        name: "United States Minor Outlying Islands",
        c1: "#bd3d44",
        c2: "#ffffff",
        c3: "#192f5d"
    },
    {
        code: "us",
        name: "United States of America",
        c1: "#bd3d44",
        c2: "#ffffff",
        c3: "#192f5d"
    },
    {
        code: "uy",
        name: "Uruguay",
        c1: "#ffffff",
        c2: "#0038a8",
        c3: "#fcd116"
    },
    {
        code: "uz",
        name: "Uzbekistan",
        c1: "#ffffff",
        c2: "#1eb53a",
        c3: "#0099b5"
    },
    {
        code: "vu",
        name: "Vanuatu",
        c1: "#d21034",
        c2: "#009543",
        c3: "#000000"
    },
    {
        code: "ve",
        name: "Venezuela",
        c1: "#cf142b",
        c2: "#ffcc00",
        c3: "#00247d"
    },
    {
        code: "vn",
        name: "Vietnam",
        c1: "#da251d",
        c2: "#ffff00"
    },
    {
        code: "vg",
        name: "Virgin Islands (British)",
        c1: "#000066",
        c2: "#ffffff",
        c3: "#c8102e"
    },
    {
        code: "vi",
        name: "Virgin Islands (U.S.)",
        c1: "#ffffff",
        c2: "#f4c53d",
        c3: "#010002"
    },
    {
        code: "gb-wls",
        name: "Wales",
        c1: "#00ab39",
        c2: "#ffffff",
        c3: "#d21034"
    },
    {
        code: "wf",
        name: "Wallis and Futuna",
        c1: "#ffffff",
        c2: "#000091",
        c3: "#e1000f"
    },
    {
        code: "eh",
        name: "Western Sahara",
        c1: "#c4111b",
        c2: "#007a3d",
        c3: "#000001"
    },
    {
        code: "ye",
        name: "Yemen",
        c1: "#ffffff",
        c2: "#f10600",
        c3: "#000001"
    },
    {
        code: "zm",
        name: "Zambia",
        c1: "#198a00",
        c2: "#ef7d00",
        c3: "#de2010"
    },
    {
        code: "zw",
        name: "Zimbabwe",
        c1: "#006400",
        c2: "#ffd200",
        c3: "#ffffff"
    },
];
class MachineEditorNodeFinder {
    static findAimedEndpoints(pickingRay, machine, currentlySelectedObject) {
        let endpoints = [];
        let currentlySelectedPart;
        let currentlySelectedEndpoint;
        if (currentlySelectedObject instanceof Core.MachinePart) {
            currentlySelectedPart = currentlySelectedObject;
        }
        else if (currentlySelectedObject) {
            currentlySelectedPart = currentlySelectedObject.machinePart;
            currentlySelectedEndpoint = currentlySelectedObject;
        }
        for (let i = 0; i < machine.parts.length; i++) {
            let part = machine.parts[i];
            if (part != currentlySelectedPart) {
                for (let j = 0; j < part.endPoints.length; j++) {
                    let endpoint = part.endPoints[j];
                    if (!endpoint.connectedEndPoint || endpoint.connectedEndPoint.machinePart === currentlySelectedObject) {
                        let d = Mummu.DistancePointRay(endpoint.absolutePosition, pickingRay);
                        if (d < Core.tileHeight * (IsTouchScreen ? 1.5 : 0.75)) {
                            endpoint["tmp_d_to_pick_ray"] = d;
                            endpoints.push(endpoint);
                        }
                    }
                }
            }
        }
        endpoints = endpoints.sort((ep1, ep2) => {
            return ep1["tmp_d_to_pick_ray"] - ep2["tmp_d_to_pick_ray"];
        });
        return endpoints;
    }
    static findAimedEndpointOnMachinePart(pickingRay, machine, machinePart) {
        let endpoints = [];
        for (let j = 0; j < machinePart.endPoints.length; j++) {
            let endpoint = machinePart.endPoints[j];
            let d = Mummu.DistancePointRay(endpoint.absolutePosition, pickingRay);
            endpoint["tmp_d_to_pick_ray"] = d;
            endpoints.push(endpoint);
        }
        endpoints = endpoints.sort((ep1, ep2) => {
            return ep1["tmp_d_to_pick_ray"] - ep2["tmp_d_to_pick_ray"];
        });
        return endpoints[0];
    }
    /*
    public static findAdequateEndpoint(part: Core.MachinePart, aimedEndPoint: Core.MachinePartEndpoint, forbidMirrorX?: boolean): Core.MachinePartEndpoint {
        let machine = part.machine;
        let aimedIsUpperHalf = aimedEndPoint.absolutePosition.y > (machine.tracksMinY + machine.tracksMaxY) * 0.5;
        let aimedIsFarHalf = aimedEndPoint.absolutePosition.z > (machine.tracksMinZ + machine.tracksMaxZ) * 0.5;

        let adequateEndpoint = part.endPoints[0];
        let adequationScore = 0;
        if (forbidMirrorX) {
            adequationScore = - Infinity;
            if (adequateEndpoint.leftSide != aimedEndPoint.leftSide) {
                adequationScore = 0;
            }
        }
        if (adequateEndpoint.farSide === aimedIsFarHalf) {
            adequationScore++;
        }
        if (adequateEndpoint.upperSide === aimedIsUpperHalf) {
            adequationScore++;
        }

        for (let i = 1; i < part.endPoints.length; i++) {
            let endpoint = part.endPoints[i];
            let score = 0;
            if (forbidMirrorX) {
                score = - Infinity;
                if (endpoint.leftSide != aimedEndPoint.leftSide) {
                    score = 0;
                }
            }
            if (endpoint.farSide === aimedIsFarHalf) {
                score++;
            }
            if (endpoint.upperSide === aimedIsUpperHalf) {
                score++;
            }
            if (score > adequationScore) {
                adequateEndpoint = endpoint;
                adequationScore = score;
            }
        }

        if (adequationScore < 0) {
            return undefined;
        }
        return adequateEndpoint;
    }
    */
    static shouldMirrorX(part, endpoint) {
        for (let i = 0; i < part.endPoints.length; i++) {
            if (part.endPoints[i].leftSide != endpoint.leftSide) {
                return false;
            }
        }
        return true;
    }
    static DEBUG_showEndpoints(machine) {
        for (let i = 0; i < machine.parts.length; i++) {
            let part = machine.parts[i];
            for (let j = 0; j < part.endPoints.length; j++) {
                let endpoint = part.endPoints[j];
                let p = endpoint.absolutePosition.clone();
                if (endpoint.leftSide) {
                    p.x += 0.02;
                    p.y += 0.005;
                }
                else {
                    p.x -= 0.02;
                    p.y -= 0.005;
                }
                if (endpoint.connectedEndPoint) {
                    Mummu.DrawDebugPoint(p, 3, BABYLON.Color3.Green(), 0.03);
                }
                else {
                    Mummu.DrawDebugPoint(p, 3, BABYLON.Color3.Red(), 0.03);
                }
            }
        }
    }
}
class MachinePartEditorMenu {
    constructor(machineEditor) {
        this.machineEditor = machineEditor;
        this.colorLines = [];
        this.colorPlusButtons = [];
        this.colorMinusButtons = [];
        this.colorValues = [];
        this._showLoadInput = false;
        this._unfolded = true;
        this._shown = false;
        this.onSave = async () => {
            let data = this.machineEditor.machine.serialize();
            let dataString = JSON.stringify(data);
            if (HasLocalStorage) {
                window.localStorage.setItem("last-saved-machine", dataString);
            }
            if (this.machineEditor.machine.isDrawBlackboardMachine) {
                let blackboardPuzzleData = BlackBoardPuzzle.SaveAsBlackBoardPuzzleData(this.machineEditor.machine);
                Nabu.download("bb-puzzle-" + this.machineEditor.machine.name + ".json", JSON.stringify(blackboardPuzzleData));
            }
            else {
                Nabu.download(this.machineEditor.machine.name + ".json", dataString);
            }
        };
        this.onPublish = async () => {
            this.machineEditor.game.shareMenuView.show(0.3);
        };
        this.onExport = async () => {
            this.machineEditor.game.exportMenuView.show(0.3);
        };
        this.onLoad = () => {
            this._showLoadInput = !this._showLoadInput;
            this.update();
        };
        this.onLoadInput = (event) => {
            let files = event.target.files;
            let file = files[0];
            if (file) {
                const reader = new FileReader();
                reader.addEventListener("load", (event) => {
                    if (event.target && typeof (event.target.result) === "string") {
                        try {
                            let machineData = JSON.parse(event.target.result);
                            this.machineEditor.machine.dispose();
                            this.machineEditor.machine.deserialize(machineData);
                            this.machineEditor.machine.instantiate();
                            this.machineEditor.machine.generateBaseMesh();
                            if (this.machineEditor.game.mode === GameMode.Create) {
                                for (let i = 0; i < this.machineEditor.machine.balls.length; i++) {
                                    this.machineEditor.machine.balls[i].setShowPositionZeroGhost(true);
                                }
                            }
                        }
                        catch (error) {
                            console.error("Failed to load file. Falling back to a Default machine.");
                            this.machineEditor.machine.dispose();
                            this.machineEditor.machine.deserialize(RandomDefault3DTrack());
                            this.machineEditor.machine.instantiate();
                            this.machineEditor.machine.generateBaseMesh();
                            if (this.machineEditor.game.mode === GameMode.Create) {
                                for (let i = 0; i < this.machineEditor.machine.balls.length; i++) {
                                    this.machineEditor.machine.balls[i].setShowPositionZeroGhost(true);
                                }
                            }
                        }
                    }
                    this._showLoadInput = false;
                    this.update();
                });
                reader.readAsText(file);
            }
        };
    }
    get currentObject() {
        if (this._currentObjects)
            return this._currentObjects[0];
    }
    set currentObject(part) {
        this._currentObjects = [part];
        this.update();
    }
    setCurrentObjects(objects) {
        this._currentObjects = [...objects];
        this.update();
    }
    get shown() {
        return this._shown;
    }
    initialize() {
        this.container = document.getElementById("machine-editor-part-menu");
        this.container.addEventListener("pointerdown", StopPointerProgatation);
        this.container.addEventListener("pointermove", StopPointerProgatation);
        this.container.addEventListener("pointerup", StopPointerProgatationAndMonkeys);
        this.titleElement = document.querySelector("#machine-editor-part-menu-title span");
        this.unfoldButton = document.querySelector("#machine-editor-part-menu-unfold");
        this.unfoldButton.onclick = () => {
            this._unfolded = true;
            this.update();
        };
        this.foldButton = document.querySelector("#machine-editor-part-menu-fold");
        this.foldButton.onclick = () => {
            this._unfolded = false;
            this.update();
        };
        this.ijkLine = document.getElementById("machine-editor-part-menu-ijk");
        this.ijkIElement = this.ijkLine.querySelector(".value.i");
        this.ijkJElement = this.ijkLine.querySelector(".value.j");
        this.ijkKElement = this.ijkLine.querySelector(".value.k");
        this.kLine = document.getElementById("machine-editor-part-menu-k");
        this.kElement = this.kLine.querySelector(".value.k");
        this.widthLine = document.getElementById("machine-editor-part-menu-width");
        this.wPlusButton = document.querySelector("#machine-editor-part-menu-width button.plus");
        this.wPlusButton.onclick = async (ev) => {
            if (this.currentObject instanceof Core.MachinePart) {
                let editedTrack = await addToTrackLengthInPlace(this.currentObject, 1, new BABYLON.Vector3(1, 0, 0));
                this.machineEditor.setSelectedObject(editedTrack);
            }
        };
        this.wMinusButton = document.querySelector("#machine-editor-part-menu-width button.minus");
        this.wMinusButton.onclick = async () => {
            if (this.currentObject instanceof Core.MachinePart) {
                let editedTrack = await addToTrackLengthInPlace(this.currentObject, -1, new BABYLON.Vector3(1, 0, 0));
                this.machineEditor.setSelectedObject(editedTrack);
            }
        };
        this.wValue = document.querySelector("#machine-editor-part-menu-width .value");
        this.heightLine = document.getElementById("machine-editor-part-menu-height");
        this.hPlusButton = document.querySelector("#machine-editor-part-menu-height button.plus");
        this.hPlusButton.onclick = async () => {
            if (this.currentObject instanceof Core.MachinePart) {
                let editedTrack = await addToTrackHeightInPlace(this.currentObject, 1);
                this.machineEditor.setSelectedObject(editedTrack);
            }
        };
        this.hMinusButton = document.querySelector("#machine-editor-part-menu-height button.minus");
        this.hMinusButton.onclick = async () => {
            if (this.currentObject instanceof Core.MachinePart) {
                let editedTrack = await addToTrackHeightInPlace(this.currentObject, -1);
                this.machineEditor.setSelectedObject(editedTrack);
            }
        };
        this.hValue = document.querySelector("#machine-editor-part-menu-height .value");
        this.depthLine = document.getElementById("machine-editor-part-menu-depth");
        this.dPlusButton = document.querySelector("#machine-editor-part-menu-depth button.plus");
        this.dPlusButton.onclick = async () => {
            if (this.currentObject instanceof Core.MachinePart) {
                let editedTrack = await addToTrackDepthInPlace(this.currentObject, 1, BABYLON.Axis.Z);
                this.machineEditor.setSelectedObject(editedTrack);
            }
        };
        this.dMinusButton = document.querySelector("#machine-editor-part-menu-depth button.minus");
        this.dMinusButton.onclick = async () => {
            if (this.currentObject instanceof Core.MachinePart) {
                let editedTrack = await addToTrackDepthInPlace(this.currentObject, -1, BABYLON.Axis.Z);
                this.machineEditor.setSelectedObject(editedTrack);
            }
        };
        this.dValue = document.querySelector("#machine-editor-part-menu-depth .value");
        this.countLine = document.getElementById("machine-editor-part-menu-count");
        this.nPlusButton = document.querySelector("#machine-editor-part-menu-count button.plus");
        this.nPlusButton.onclick = async () => {
            if (this.currentObject instanceof Core.MachinePart && this.currentObject.nExtendable) {
                let n = this.currentObject.n + 1;
                if (n <= this.currentObject.maxN) {
                    let editedTrack = await editTrackInPlace(this.currentObject, { n: n });
                    this.machineEditor.setSelectedObject(editedTrack);
                }
            }
            else if (this.currentObject instanceof Core.MachineDecor) {
                let n = this.currentObject.n + 1;
                this.currentObject.setN(n);
                this.nValue.innerText = Core.Xylophone.NotesName[this.currentObject.n];
            }
        };
        this.nMinusButton = document.querySelector("#machine-editor-part-menu-count button.minus");
        this.nMinusButton.onclick = async () => {
            if (this.currentObject instanceof Core.MachinePart && this.currentObject.nExtendable) {
                let n = this.currentObject.n - 1;
                if (n >= this.currentObject.minN) {
                    let editedTrack = await editTrackInPlace(this.currentObject, { n: n });
                    this.machineEditor.setSelectedObject(editedTrack);
                }
            }
            else if (this.currentObject instanceof Core.MachineDecor) {
                let n = this.currentObject.n - 1;
                this.currentObject.setN(n);
                this.nValue.innerText = Core.Xylophone.NotesName[this.currentObject.n];
            }
        };
        this.nValue = document.querySelector("#machine-editor-part-menu-count .value");
        this.speedLine = document.getElementById("machine-editor-part-menu-speed");
        this.sPlusButton = document.querySelector("#machine-editor-part-menu-speed button.plus");
        this.sPlusButton.onclick = async () => {
            let promises = [];
            let nonEditedParts = [];
            for (let i = 0; i < this._currentObjects.length; i++) {
                let part = this._currentObjects[i];
                if (part instanceof Core.MachinePart && part.sExtendable && (part.s + 1 <= part.maxS)) {
                    promises.push(editTrackInPlace(part, { s: part.s + 1 }));
                }
                else {
                    nonEditedParts.push(part);
                }
            }
            let editedParts = await Promise.all(promises);
            if (editedParts[0]) {
                this.machineEditor.setSelectedObject(editedParts[0]);
            }
            else {
                this.machineEditor.setSelectedObject(undefined);
            }
            for (let i = 1; i < editedParts.length; i++) {
                this.machineEditor.addOrRemoveSelectedObjects(editedParts[i]);
            }
            for (let i = 0; i < nonEditedParts.length; i++) {
                this.machineEditor.addOrRemoveSelectedObjects(nonEditedParts[i]);
            }
        };
        this.sMinusButton = document.querySelector("#machine-editor-part-menu-speed button.minus");
        this.sMinusButton.onclick = async () => {
            let promises = [];
            let nonEditedParts = [];
            for (let i = 0; i < this._currentObjects.length; i++) {
                let part = this._currentObjects[i];
                if (part instanceof Core.MachinePart && part.sExtendable && part.s - 1 >= part.minS) {
                    promises.push(editTrackInPlace(part, { s: part.s - 1 }));
                }
                else {
                    nonEditedParts.push(part);
                }
            }
            let editedParts = await Promise.all(promises);
            if (editedParts[0]) {
                this.machineEditor.setSelectedObject(editedParts[0]);
            }
            else {
                this.machineEditor.setSelectedObject(undefined);
            }
            for (let i = 1; i < editedParts.length; i++) {
                this.machineEditor.addOrRemoveSelectedObjects(editedParts[i]);
            }
            for (let i = 0; i < nonEditedParts.length; i++) {
                this.machineEditor.addOrRemoveSelectedObjects(nonEditedParts[i]);
            }
        };
        this.sValue = document.querySelector("#machine-editor-part-menu-speed .value");
        for (let i = 0; i < Core.colorSlotsCount; i++) {
            let colorSlotIndex = i;
            this.colorLines[i] = document.getElementById("machine-editor-part-menu-color-" + i.toFixed(0));
            this.colorPlusButtons[i] = document.querySelector("#machine-editor-part-menu-color-" + i.toFixed(0) + " button.plus");
            this.colorPlusButtons[i].onclick = async () => {
                if (this._currentObjects.length > 1) {
                }
                else if (this.currentObject instanceof Core.MachinePart) {
                    let colors = [...this.currentObject.colors];
                    let currentColorListIndex = MachineEditorPartColors.findIndex((v) => { return v.index === colors[colorSlotIndex]; });
                    currentColorListIndex = (currentColorListIndex + 1) % MachineEditorPartColors.length;
                    colors[colorSlotIndex] = MachineEditorPartColors[currentColorListIndex].index;
                    this.machineEditor.lastSelectedColors[colorSlotIndex] = MachineEditorPartColors[currentColorListIndex].index;
                    let editedTrack = await editTrackInPlace(this.currentObject, { c: colors });
                    this.machineEditor.setSelectedObject(editedTrack);
                }
                else if (this.currentObject instanceof Core.Ball) {
                    let currentColorListIndex = MachineEditorBallColors.findIndex((v) => { return v.index === this.currentObject.materialIndex; });
                    currentColorListIndex = (currentColorListIndex + 1) % MachineEditorBallColors.length;
                    this.currentObject.materialIndex = MachineEditorBallColors[currentColorListIndex].index;
                    this.machineEditor.lastBallMaterialIndex = this.currentObject.materialIndex;
                    this.update();
                }
            };
            this.colorMinusButtons[i] = document.querySelector("#machine-editor-part-menu-color-" + i.toFixed(0) + " button.minus");
            this.colorMinusButtons[i].onclick = async () => {
                if (this._currentObjects.length > 1) {
                }
                else if (this.currentObject instanceof Core.MachinePart) {
                    let colors = [...this.currentObject.colors];
                    let currentColorListIndex = MachineEditorPartColors.findIndex((v) => { return v.index === colors[colorSlotIndex]; });
                    currentColorListIndex = (currentColorListIndex - 1 + MachineEditorPartColors.length) % MachineEditorPartColors.length;
                    colors[colorSlotIndex] = MachineEditorPartColors[currentColorListIndex].index;
                    this.machineEditor.lastSelectedColors[colorSlotIndex] = MachineEditorPartColors[currentColorListIndex].index;
                    let editedTrack = await editTrackInPlace(this.currentObject, { c: colors });
                    this.machineEditor.setSelectedObject(editedTrack);
                }
                else if (this.currentObject instanceof Core.Ball) {
                    let currentColorListIndex = MachineEditorBallColors.findIndex((v) => { return v.index === this.currentObject.materialIndex; });
                    currentColorListIndex = (currentColorListIndex - 1 + MachineEditorBallColors.length) % MachineEditorBallColors.length;
                    this.currentObject.materialIndex = MachineEditorBallColors[currentColorListIndex].index;
                    this.machineEditor.lastBallMaterialIndex = this.currentObject.materialIndex;
                    this.update();
                }
            };
            let I = i;
            this.colorValues[i] = document.querySelector("#machine-editor-part-menu-color-" + i.toFixed(0) + " .color-value");
            if (this.colorValues[I]) {
                this.colorValues[I].onclick = (ev) => {
                    if (this.currentObject instanceof Core.MachinePart) {
                        if (this.machineEditor.game.materialPicker.shown &&
                            this.machineEditor.game.materialPicker.target === this.currentObject &&
                            this.machineEditor.game.materialPicker.targetIndex === I) {
                            this.setSelectedColorSlot(-1);
                            this.machineEditor.game.materialPicker.hide();
                        }
                        else {
                            this.setSelectedColorSlot(I);
                            if (document.body.classList.contains("vertical")) {
                                let bbox = this.machineEditor.game.toolbar.container.getBoundingClientRect();
                                this.machineEditor.game.materialPicker.setAnchor(10, window.innerHeight - bbox.top + 20);
                            }
                            else {
                                let bbox = this.container.getBoundingClientRect();
                                this.machineEditor.game.materialPicker.setAnchor(bbox.right + 10, ev.clientY);
                            }
                            this.machineEditor.game.materialPicker.setCurrentColorIndex(this.currentObject.colors[I]);
                            this.machineEditor.game.materialPicker.onColorIndexChanged = async (colorIndex) => {
                                if (this._currentObjects.length > 1) {
                                    let promises = [];
                                    let nonEditedParts = [];
                                    for (let i = 0; i < this._currentObjects.length; i++) {
                                        let part = this._currentObjects[i];
                                        if (part instanceof Core.MachinePart && isFinite(part.colors[I])) {
                                            let colors = [...part.colors];
                                            colors[I] = colorIndex;
                                            this.machineEditor.lastSelectedColors[I] = colorIndex;
                                            promises.push(editTrackInPlace(part, { c: colors }));
                                        }
                                        else {
                                            nonEditedParts.push(part);
                                        }
                                    }
                                    let editedParts = await Promise.all(promises);
                                    if (editedParts[0]) {
                                        this.machineEditor.setSelectedObject(editedParts[0]);
                                    }
                                    else {
                                        this.machineEditor.setSelectedObject(undefined);
                                    }
                                    for (let i = 1; i < editedParts.length; i++) {
                                        this.machineEditor.addOrRemoveSelectedObjects(editedParts[i]);
                                    }
                                    for (let i = 0; i < nonEditedParts.length; i++) {
                                        this.machineEditor.addOrRemoveSelectedObjects(nonEditedParts[i]);
                                    }
                                }
                                else if (this.currentObject instanceof Core.MachinePart) {
                                    let colors = [...this.currentObject.colors];
                                    colors[I] = colorIndex;
                                    this.machineEditor.lastSelectedColors[I] = colorIndex;
                                    let editedTrack = await editTrackInPlace(this.currentObject, { c: colors });
                                    this.machineEditor.setSelectedObject(editedTrack);
                                }
                            };
                            this.machineEditor.game.materialPicker.show();
                            this.machineEditor.game.materialPicker.target = this.currentObject;
                            this.machineEditor.game.materialPicker.targetIndex = I;
                        }
                    }
                    else if (this.currentObject instanceof Core.Ball) {
                        if (this.machineEditor.game.ballMaterialPicker.shown &&
                            this.machineEditor.game.ballMaterialPicker.target === this.currentObject &&
                            this.machineEditor.game.ballMaterialPicker.targetIndex === I) {
                            this.setSelectedColorSlot(-1);
                            this.machineEditor.game.ballMaterialPicker.hide();
                        }
                        else {
                            this.setSelectedColorSlot(I);
                            if (document.body.classList.contains("vertical")) {
                                let bbox = this.machineEditor.game.toolbar.container.getBoundingClientRect();
                                this.machineEditor.game.ballMaterialPicker.setAnchor(10, window.innerHeight - bbox.top + 20);
                            }
                            else {
                                let bbox = this.container.getBoundingClientRect();
                                this.machineEditor.game.ballMaterialPicker.setAnchor(bbox.right + 10, ev.clientY);
                            }
                            this.machineEditor.game.ballMaterialPicker.setCurrentColorIndex(this.currentObject.materialIndex);
                            this.machineEditor.game.ballMaterialPicker.onColorIndexChanged = async (colorIndex) => {
                                if (this.currentObject instanceof Core.Ball) {
                                    this.currentObject.materialIndex = colorIndex;
                                    this.machineEditor.lastBallMaterialIndex = this.currentObject.materialIndex;
                                    this.update();
                                }
                            };
                            this.machineEditor.game.ballMaterialPicker.show();
                            this.machineEditor.game.ballMaterialPicker.target = this.currentObject;
                            this.machineEditor.game.ballMaterialPicker.targetIndex = I;
                        }
                    }
                };
            }
        }
        this.mirrorXLine = document.getElementById("machine-editor-part-menu-mirrorX");
        this.mirrorXButton = document.querySelector("#machine-editor-part-menu-mirrorX button");
        this.mirrorXButton.onclick = async () => {
            if (this.currentObject instanceof Core.MachinePart) {
                let editedTrack = await this.machineEditor.mirrorXTrackInPlace(this.currentObject);
                this.machineEditor.setSelectedObject(editedTrack);
            }
            else if (this.currentObject instanceof Core.MachineDecor) {
                this.currentObject.setFlip(!this.currentObject.flip);
            }
        };
        this.mirrorZLine = document.getElementById("machine-editor-part-menu-mirrorZ");
        this.mirrorZButton = document.querySelector("#machine-editor-part-menu-mirrorZ button");
        this.mirrorZButton.onclick = async () => {
            if (this.currentObject instanceof Core.MachinePart) {
                let editedTrack = await this.machineEditor.mirrorZTrackInPlace(this.currentObject);
                this.machineEditor.setSelectedObject(editedTrack);
            }
        };
        this.fillLine = document.getElementById("machine-editor-part-menu-fill");
        this.fillButton = document.querySelector("#machine-editor-part-menu-fill button");
        this.fillButton.onclick = this.machineEditor._onFill;
        this.focusLine = document.getElementById("machine-editor-part-menu-focus");
        this.focusButton = document.querySelector("#machine-editor-part-menu-focus button");
        this.focusButton.onclick = this.machineEditor._onFocus;
        this.deleteLine = document.getElementById("machine-editor-part-menu-delete");
        this.deleteButton = document.querySelector("#machine-editor-part-menu-delete button");
        this.deleteButton.onclick = async () => {
            if (this.currentObject) {
                if (this.currentObject instanceof Core.MachinePart) {
                    if (this.currentObject.onBeforeDelete) {
                        this.currentObject.onBeforeDelete();
                    }
                }
                this.currentObject.dispose();
                this.machineEditor.setSelectedObject(undefined);
                this.machineEditor.setDraggedObject(undefined);
                this.machineEditor.machine.generateBaseMesh();
            }
        };
        this.publishLine = document.getElementById("machine-editor-part-menu-publish");
        this.exportLine = document.getElementById("machine-editor-part-menu-export");
        this.fileLine = document.getElementById("machine-editor-part-menu-file");
        this.saveButton = document.getElementById("machine-editor-part-menu-save");
        this.saveButton.onclick = this.onSave;
        this.loadButton = document.getElementById("machine-editor-part-menu-load");
        this.loadButton.onclick = this.onLoad;
        this.loadInput = document.getElementById("machine-editor-part-menu-load-input");
        this.loadInput.oninput = this.onLoadInput;
        this.publishButton = document.getElementById("machine-editor-part-menu-publish-button");
        this.publishButton.onclick = this.onPublish;
        if (this.machineEditor.game.OFFLINE_MODE) {
            this.publishButton.classList.add("disabled");
        }
        else {
            this.publishButton.classList.remove("disabled");
        }
        this.exportButton = document.getElementById("machine-editor-part-menu-export-button");
        this.exportButton.onclick = this.onExport;
        this.baseLine = document.getElementById("machine-editor-part-menu-base");
        this.roomLine = document.getElementById("machine-editor-part-menu-room");
        this.roomMinusButton = document.querySelector("#machine-editor-part-menu-room button.minus");
        this.roomMinusButton.onclick = async () => {
            let roomListIndex = MachineEditorRooms.findIndex(v => { return v.index === this.machineEditor.machine.roomIndex; });
            roomListIndex = (roomListIndex - 1 + MachineEditorRooms.length) % MachineEditorRooms.length;
            this.machineEditor.machine.setRoomIndex(MachineEditorRooms[roomListIndex].index);
            this.update();
        };
        this.roomPlusButton = document.querySelector("#machine-editor-part-menu-room button.plus");
        this.roomPlusButton.onclick = async () => {
            let roomListIndex = MachineEditorRooms.findIndex(v => { return v.index === this.machineEditor.machine.roomIndex; });
            roomListIndex = (roomListIndex + 1) % MachineEditorRooms.length;
            this.machineEditor.machine.setRoomIndex(MachineEditorRooms[roomListIndex].index);
            this.update();
        };
        this.roomValue = document.querySelector("#machine-editor-part-menu-room .value");
        this.cellShadingLine = document.getElementById("machine-editor-part-menu-cell-shading");
        this.cellShadingButton = document.querySelector("#machine-editor-part-menu-cell-shading button");
        this.cellShadingButton.onclick = async () => {
            this.machineEditor.machine.toonOutlineRender = !this.machineEditor.machine.toonOutlineRender;
            this.machineEditor.machine.instantiate(true);
            this.update();
        };
        this.supportLine = document.getElementById("machine-editor-part-menu-support");
        this.supportMinusButton = document.querySelector("#machine-editor-part-menu-support button.minus");
        this.supportMinusButton.onclick = async () => {
            let maxY = Nabu.MinMax(this.machineEditor.machine.sleepersMeshProp.grndAnchorsMaxY - 0.1, 0, 1);
            this.machineEditor.machine.sleepersMeshProp.grndAnchorsMaxY = maxY;
            this.machineEditor.machine.parts.forEach(part => {
                part.sleepersMeshProp.grndAnchorsMaxY = this.machineEditor.machine.sleepersMeshProp.grndAnchorsMaxY;
                part.doSleepersMeshUpdate();
            });
            this.update();
        };
        this.supportPlusButton = document.querySelector("#machine-editor-part-menu-support button.plus");
        this.supportPlusButton.onclick = async () => {
            let maxY = Nabu.MinMax(this.machineEditor.machine.sleepersMeshProp.grndAnchorsMaxY + 0.1, 0, 1);
            this.machineEditor.machine.sleepersMeshProp.grndAnchorsMaxY = maxY;
            this.machineEditor.machine.parts.forEach(part => {
                part.sleepersMeshProp.grndAnchorsMaxY = this.machineEditor.machine.sleepersMeshProp.grndAnchorsMaxY;
                part.doSleepersMeshUpdate();
            });
            this.update();
        };
        this.supportValue = document.querySelector("#machine-editor-part-menu-support .value");
        this.clearLine = document.querySelector("#machine-editor-part-menu-machine-clear");
        this.clearButton = this.clearLine.querySelector("button");
        let clearTime = NaN;
        let clearDuration = 2;
        let updateClearButtonColorStyle = () => {
            let f = (performance.now() / 1000 - clearTime) / clearDuration;
            f = Nabu.MinMax(f, 0, 1);
            let p = f * 100;
            if (p < 2) {
                this.clearButton.style.background = "";
            }
            else if (p < 98) {
                this.clearButton.style.background = "linear-gradient(to right, red 0%, red " + (p - 2).toFixed(1) + "%, #474b4e " + (p + 2).toFixed(1) + "%, #474b4e 100%)";
            }
            else if (isFinite(p)) {
                this.clearButton.style.background = "linear-gradient(to right, red 0%, red 100%)";
            }
        };
        this.clearButton.onpointerdown = () => {
            clearTime = performance.now() / 1000;
            this.machineEditor.game.scene.onBeforeRenderObservable.removeCallback(updateClearButtonColorStyle);
            this.machineEditor.game.scene.onBeforeRenderObservable.add(updateClearButtonColorStyle);
        };
        this.clearButton.onpointerleave = () => {
            clearTime = NaN;
            this.machineEditor.game.scene.onBeforeRenderObservable.removeCallback(updateClearButtonColorStyle);
            this.clearButton.style.background = "";
        };
        this.clearButton.onpointerup = () => {
            let f = (performance.now() / 1000 - clearTime) / clearDuration;
            if (f >= 1) {
                let machine = this.machineEditor.machine;
                while (machine.balls.length > 0) {
                    machine.balls[0].dispose();
                }
                while (machine.parts.length > 0) {
                    machine.parts[0].dispose();
                }
                while (machine.decors.length > 0) {
                    machine.decors[0].dispose();
                }
                machine.requestUpdateBaseMesh = true;
            }
            clearTime = NaN;
            this.machineEditor.game.scene.onBeforeRenderObservable.removeCallback(updateClearButtonColorStyle);
            this.clearButton.style.background = "";
        };
    }
    dispose() {
        this.currentObject = undefined;
        if (this.container) {
            this.container.removeEventListener("pointerdown", StopPointerProgatation);
            this.container.removeEventListener("pointermove", StopPointerProgatation);
            this.container.removeEventListener("pointerup", StopPointerProgatationAndMonkeys);
        }
    }
    setSelectedColorSlot(slotIndex) {
        for (let i = 0; i < this.colorValues.length; i++) {
            this.colorValues[i].classList.remove("selected");
        }
        if (this.colorValues[slotIndex]) {
            this.colorValues[slotIndex].classList.add("selected");
        }
    }
    update() {
        if (this.container) {
            if (!this.currentObject && this.machineEditor.game.mode === GameMode.Create) {
                this.setSelectedColorSlot(-1);
                this.machineEditor.game.updateMachineAuthorAndNameVisibility();
                this.machineEditor.game.materialPicker.hide();
                this.machineEditor.game.ballMaterialPicker.hide();
                this.container.style.display = "";
                this._shown = true;
                this.unfoldButton.style.display = this._unfolded ? "none" : "";
                this.foldButton.style.display = this._unfolded ? "" : "none";
                this.titleElement.innerText = "全部";
                this.ijkLine.style.display = "none";
                this.kLine.style.display = "none";
                this.widthLine.style.display = "none";
                this.heightLine.style.display = "none";
                this.depthLine.style.display = "none";
                this.speedLine.style.display = "none";
                this.countLine.style.display = "none";
                for (let i = 0; i < Core.colorSlotsCount; i++) {
                    this.colorLines[i].style.display = "none";
                }
                this.mirrorXLine.style.display = "none";
                this.mirrorZLine.style.display = "none";
                this.fillLine.style.display = "none";
                this.focusLine.style.display = "none";
                this.deleteLine.style.display = "none";
                this.publishLine.style.display = this._unfolded ? "" : "none";
                this.exportLine.style.display = this._unfolded ? "" : "none";
                this.fileLine.style.display = this._unfolded && !IsMobile ? "" : "none";
                this.loadInput.style.display = this._showLoadInput && this._unfolded ? "" : "none";
                this.baseLine.style.display = "none";
                this.roomLine.style.display = this._unfolded ? "" : "none";
                this.cellShadingLine.style.display = this._unfolded ? "" : "none";
                if (IsMobile) {
                    this.cellShadingButton.innerText = this.machineEditor.machine.toonOutlineRender ? "Toon : ON" : "Toon : OFF";
                }
                else {
                    this.cellShadingButton.innerText = this.machineEditor.machine.toonOutlineRender ? "ON" : "OFF";
                }
                this.supportLine.style.display = this.machineEditor.game.devMode.activated && this._unfolded ? "" : "none";
                this.clearLine.style.display = this._unfolded ? "" : "none";
                let roomListIndex = MachineEditorRooms.findIndex(v => { return v.index === this.machineEditor.machine.roomIndex; });
                this.roomValue.innerHTML = MachineEditorRooms[roomListIndex].roomName;
                if (this.machineEditor.machine && this.machineEditor.machine.sleepersMeshProp) {
                    this.supportValue.innerHTML = this.machineEditor.machine.sleepersMeshProp.grndAnchorsMaxY.toFixed(1);
                }
            }
            else if (this._currentObjects.length > 1) {
                let challengeMode = this.machineEditor.game.mode === GameMode.Challenge;
                let maxSelectedColorSlotsCount = 0;
                this._currentObjects.forEach(object => {
                    if (object instanceof Core.MachinePart) {
                        maxSelectedColorSlotsCount = Math.max(maxSelectedColorSlotsCount, object.colors.length);
                    }
                });
                this.container.style.display = "";
                this._shown = true;
                this.machineEditor.game.updateMachineAuthorAndNameVisibility();
                this.unfoldButton.style.display = this._unfolded ? "none" : "";
                this.foldButton.style.display = this._unfolded ? "" : "none";
                this.ijkLine.style.display = this.machineEditor.game.DEBUG_MODE ? "" : "none";
                this.kLine.style.display = "none";
                this.widthLine.style.display = "none";
                this.heightLine.style.display = "none";
                this.depthLine.style.display = "none";
                this.countLine.style.display = "none";
                for (let i = 0; i < Core.colorSlotsCount; i++) {
                    this.colorLines[i].style.display = i < maxSelectedColorSlotsCount ? "" : "none";
                }
                this.mirrorXLine.style.display = "none";
                this.mirrorZLine.style.display = "none";
                this.fillLine.style.display = this._unfolded && this.currentObject instanceof Core.Elevator && !challengeMode ? "" : "none";
                this.focusLine.style.display = this._unfolded ? "" : "none";
                this.deleteLine.style.display = this._unfolded ? "" : "none";
                this.publishLine.style.display = "none";
                this.exportLine.style.display = "none";
                this.fileLine.style.display = "none";
                this._showLoadInput = false;
                this.loadInput.style.display = "none";
                this.roomLine.style.display = "none";
                this.cellShadingLine.style.display = "none";
                this.baseLine.style.display = "none";
                this.supportLine.style.display = "none";
                this.clearLine.style.display = "none";
                this.titleElement.innerText = this._currentObjects.length.toFixed(0) + " objects";
                let commonSValue = -1;
                this._currentObjects.forEach(object => {
                    if (isFinite(commonSValue)) {
                        if (object instanceof Core.MachinePart) {
                            if (object.sExtendable) {
                                if (commonSValue === -1 || commonSValue === object.s) {
                                    commonSValue = object.s;
                                }
                                else {
                                    commonSValue = undefined;
                                }
                            }
                        }
                    }
                });
                if (commonSValue >= 0) {
                    this.speedLine.style.display = "";
                    this.sValue.innerText = Core.TrackSpeedNames[commonSValue];
                }
                else if (commonSValue === undefined) {
                    this.speedLine.style.display = "";
                    this.sValue.innerText = "...";
                }
                else if (commonSValue === -1) {
                    this.speedLine.style.display = "none";
                }
                for (let i = 0; i < maxSelectedColorSlotsCount; i++) {
                    let commonColor = -1;
                    this._currentObjects.forEach(object => {
                        if (isFinite(commonColor)) {
                            if (object instanceof Core.MachinePart) {
                                if (isFinite(object.colors[i])) {
                                    if (commonColor === -1 || commonColor === object.colors[i]) {
                                        commonColor = object.colors[i];
                                    }
                                    else {
                                        commonColor = undefined;
                                    }
                                }
                            }
                        }
                    });
                    if (commonColor >= 0) {
                        this.colorValues[i].style.backgroundColor = this.machineEditor.game.materials.getMaterialHexBaseColor(commonColor, this.machineEditor.game.getMaterialQ());
                        this.colorValues[i].innerText = "";
                    }
                    else {
                        this.colorValues[i].style.backgroundColor = "#ffffff10";
                        this.colorValues[i].innerText = "...";
                    }
                }
            }
            else if (this.currentObject && (this.machineEditor.game.mode === GameMode.Create || this.machineEditor.game.mode === GameMode.Challenge)) {
                let challengeMode = this.machineEditor.game.mode === GameMode.Challenge;
                let allowEditMachinePart = this.machineEditor.allowEditMachinePart;
                let allowAutoMirrorXOnDrag = this.machineEditor.allowAutoMirrorXOnDrag;
                this.container.style.display = "";
                this._shown = true;
                this.machineEditor.game.updateMachineAuthorAndNameVisibility();
                this.unfoldButton.style.display = this._unfolded ? "none" : "";
                this.foldButton.style.display = this._unfolded ? "" : "none";
                this.ijkLine.style.display = this.machineEditor.game.DEBUG_MODE ? "" : "none";
                this.kLine.style.display = "none";
                this.widthLine.style.display = this._unfolded && this.currentObject instanceof Core.MachinePart && this.currentObject.xExtendable && allowEditMachinePart ? "" : "none";
                this.heightLine.style.display = this._unfolded && this.currentObject instanceof Core.MachinePart && this.currentObject.yExtendable && allowEditMachinePart ? "" : "none";
                this.depthLine.style.display = this._unfolded && this.currentObject instanceof Core.MachinePart && this.currentObject.zExtendable && allowEditMachinePart ? "" : "none";
                this.speedLine.style.display = this._unfolded && this.currentObject instanceof Core.MachinePart && this.currentObject.sExtendable && allowEditMachinePart ? "" : "none";
                let showCountLine = false;
                if (this._unfolded) {
                    if (allowEditMachinePart) {
                        if (this.currentObject instanceof Core.MachinePart && this.currentObject.nExtendable || this.currentObject instanceof Core.MachineDecor) {
                            showCountLine = true;
                        }
                    }
                }
                this.countLine.style.display = showCountLine ? "" : "none";
                this.colorLines[0].style.display = this._unfolded && !challengeMode ? "" : "none";
                for (let i = 1; i < Core.colorSlotsCount; i++) {
                    this.colorLines[i].style.display = this._unfolded && this.currentObject instanceof Core.MachinePart && this.currentObject.colors.length > i && !challengeMode ? "" : "none";
                }
                let showMirrorXLine = false;
                if (this._unfolded) {
                    if (this.currentObject instanceof Core.MachinePart && this.currentObject.mirrorable && allowAutoMirrorXOnDrag || this.currentObject instanceof Core.MachineDecor) {
                        showMirrorXLine = true;
                    }
                }
                this.mirrorXLine.style.display = showMirrorXLine ? "" : "none";
                this.mirrorZLine.style.display = this._unfolded && this.currentObject instanceof Core.MachinePart && this.currentObject.zMirrorable && allowAutoMirrorXOnDrag ? "" : "none";
                this.fillLine.style.display = this._unfolded && this.currentObject instanceof Core.Elevator && !challengeMode ? "" : "none";
                this.focusLine.style.display = this._unfolded ? "" : "none";
                this.deleteLine.style.display = this._unfolded ? "" : "none";
                this.publishLine.style.display = "none";
                this.exportLine.style.display = "none";
                this.fileLine.style.display = "none";
                this._showLoadInput = false;
                this.loadInput.style.display = "none";
                this.roomLine.style.display = "none";
                this.cellShadingLine.style.display = "none";
                this.baseLine.style.display = "none";
                this.supportLine.style.display = "none";
                this.clearLine.style.display = "none";
                if (this.currentObject instanceof Core.MachinePart) {
                    this.machineEditor.game.ballMaterialPicker.hide();
                    let part = this.currentObject;
                    this.titleElement.innerText = part.partName;
                    this.ijkIElement.innerText = part.i.toFixed(0);
                    this.ijkJElement.innerText = part.j.toFixed(0);
                    this.ijkKElement.innerText = part.k.toFixed(0);
                    this.wValue.innerText = part.w.toFixed(0);
                    this.hValue.innerText = part.h.toFixed(0);
                    this.dValue.innerText = part.d.toFixed(0);
                    this.nValue.innerText = part.n.toFixed(0);
                    this.sValue.innerText = Core.TrackSpeedNames[part.s];
                    for (let i = 0; i < part.colors.length; i++) {
                        //let currentColorListIndex = MachineEditorPartColors.findIndex((v) => { return v.index === part.colors[i]; });
                        //let prevColorListIndex = (currentColorListIndex - 1 + MachineEditorPartColors.length) % MachineEditorPartColors.length;
                        //let prevColorIndex = MachineEditorPartColors[prevColorListIndex].index;
                        //let nextColorListIndex = (currentColorListIndex + 1) % MachineEditorPartColors.length;
                        //let nextColorIndex = MachineEditorPartColors[nextColorListIndex].index;
                        //this.colorMinusButtons[i].style.backgroundColor = this.machineEditor.game.materials.getMaterialHexBaseColor(prevColorIndex);
                        this.colorValues[i].style.backgroundColor = this.machineEditor.game.materials.getMaterialHexBaseColor(part.colors[i], this.machineEditor.game.getMaterialQ());
                        //this.colorPlusButtons[i].style.backgroundColor = this.machineEditor.game.materials.getMaterialHexBaseColor(nextColorIndex);
                        this.colorValues[i].innerText = "";
                    }
                }
                else if (this.currentObject instanceof Core.Ball) {
                    this.machineEditor.game.materialPicker.hide();
                    if (this.machineEditor.game.ballMaterialPicker.shown && this.machineEditor.game.ballMaterialPicker.target !== this.currentObject) {
                        this.machineEditor.game.ballMaterialPicker.target = this.currentObject;
                        this.machineEditor.game.ballMaterialPicker.setCurrentColorIndex(this.currentObject.materialIndex);
                    }
                    this.titleElement.innerText = "彈珠";
                    this.kElement.innerText = this.currentObject.k.toFixed(0);
                    this.colorValues[0].style.backgroundColor = this.machineEditor.game.materials.getBallMaterialHexBaseColor(this.currentObject.materialIndex, this.machineEditor.game.getMaterialQ());
                    this.colorValues[0].innerText = "";
                }
                else if (this.currentObject instanceof Core.MachineDecor) {
                    this.nValue.innerText = Core.Xylophone.NotesName[this.currentObject.n];
                }
            }
            else {
                this.container.style.display = "none";
                this._shown = false;
            }
        }
    }
}
class Note {
    constructor(name, delay) {
        this.name = name;
        this.delay = delay;
    }
}
class XyloMaker {
    constructor(machineEditor) {
        this.machineEditor = machineEditor;
        this.letterFurElise = [
            new Note("E6", 0.5),
            new Note("D6#", 0.5),
            new Note("E6", 0.5),
            new Note("D6#", 0.5),
            new Note("E6", 0.5),
            new Note("B6", 0.5),
            new Note("D6#", 0.5),
            new Note("C6", 0.5),
            new Note("A6", 1.5),
            new Note("C5", 0.5),
            new Note("E5", 0.5),
            new Note("A6", 0.5),
            new Note("B6", 1.5),
            new Note("E5", 0.5),
            new Note("G5#", 0.5),
            new Note("B6", 0.5),
            new Note("C6", 1.5),
            new Note("E5", 0.5),
            new Note("E6", 0.5),
            new Note("D6#", 0.5),
            new Note("E6", 0.5),
            new Note("D6#", 0.5),
            new Note("E6", 0.5),
            new Note("B6", 0.5),
            new Note("D6#", 0.5),
            new Note("C6", 0.5),
            new Note("A6", 1.5),
            new Note("C5", 0.5),
            new Note("E5", 0.5),
            new Note("A6", 0.5),
            new Note("B6", 1.5),
            new Note("E5", 0.5),
            new Note("C6", 0.5),
            new Note("B6", 0.5),
            new Note("A6", 1.5),
        ];
        this.started = false;
        this.index = 0;
        this._updateTimout = 0;
        this._update = () => {
            if (this.ball) {
                if (this.index < this.letterFurElise.length) {
                    let noteName = this.letterFurElise[this.index].name;
                    let noteLength = this.letterFurElise[this.index].delay;
                    this.index++;
                    let xylophone = new Core.Xylophone(this.machineEditor.machine);
                    xylophone.setN(Core.Xylophone.NotesName.indexOf(noteName));
                    console.log(noteName + " N = " + xylophone.n);
                    this.machineEditor.machine.decors.push(xylophone);
                    xylophone.position.copyFrom(this.ball.position);
                    xylophone.findMachinePart();
                    if (xylophone.machinePart) {
                        let pos = BABYLON.Vector3.Zero();
                        xylophone.machinePart.getProjection(xylophone.position, pos, BABYLON.Vector3.Right(), BABYLON.Vector3.Up());
                        xylophone.setPosition(pos);
                    }
                    xylophone.instantiate();
                    this._updateTimout = setTimeout(this._update, noteLength * (60 / 90 * 1000));
                }
            }
        };
    }
    reset() {
        this.machineEditor.game.showGraphicAutoUpdateAlert("Reset Xylomaker");
        this.ball = undefined;
        this.index = 0;
        clearTimeout(this._updateTimout);
    }
    start() {
        if (this.ball) {
            this.machineEditor.game.showGraphicAutoUpdateAlert("Start Xylomaker");
            this._update();
        }
    }
    stop() {
        this.machineEditor.game.showGraphicAutoUpdateAlert("Stop Xylomaker");
        clearTimeout(this._updateTimout);
    }
}
class BBPuzzlesLoader {
    constructor(game) {
        this.game = game;
        this._dataPackLoaded = false;
        this.puzzlesDataFiles = new Map();
        this.scores = [];
        if (HasLocalStorage) {
            if (window.localStorage.getItem("bb-puzzles-scores-v3")) {
                this.scores = JSON.parse(window.localStorage.getItem("bb-puzzles-scores-v3"));
            }
        }
    }
    async getPuzzle(puzzleName, ignoreDataPack) {
        let data;
        if (!ignoreDataPack) {
            if (!this.puzzlesDataPack) {
                await this.loadDataPack();
            }
            if (this.puzzlesDataPack) {
                let machineName = puzzleName.replace("bb-puzzle-", "").replace("-bouncermode", "");
                data = this.puzzlesDataPack.bbPuzzles.find(data => { return data.machine.title === machineName; });
                if (data) {
                    //console.log("Puzzle " + puzzleName.padEnd(32, " ") + " loaded from DataPack");
                    return data;
                }
            }
        }
        if (!data) {
            let bbPuzzleDataResponse = await fetch("./datas/bb-puzzles/" + puzzleName.replace("-bouncermode", "") + ".json");
            if (bbPuzzleDataResponse && bbPuzzleDataResponse.status === 200) {
                data = (await bbPuzzleDataResponse.json());
                //console.log("Puzzle " + puzzleName.padEnd(32, " ") + " loaded from File");
            }
        }
        return data;
    }
    async loadDataPack() {
        let bbPuzzlePackDataResponse = await fetch("./datas/bb-puzzles/bb-puzzles-pack.json");
        if (bbPuzzlePackDataResponse && bbPuzzlePackDataResponse.status === 200) {
            this.puzzlesDataPack = (await bbPuzzlePackDataResponse.json());
            this._dataPackLoaded = true;
        }
    }
    getScore(puzzleName) {
        return this.scores.find(score => { return score.puzzleName === puzzleName; });
    }
    setScore(score) {
        let existingScore = this.getScore(score.puzzleName);
        if (existingScore) {
            existingScore.stars = score.stars;
            existingScore.material = score.material;
        }
        else {
            this.scores.push(score);
        }
        if (HasLocalStorage) {
            window.localStorage.setItem("bb-puzzles-scores-v3", JSON.stringify(this.scores));
        }
    }
    getTotalStarsCount() {
        let totalStarsCount = 0;
        this.scores.forEach(score => {
            totalStarsCount += score.stars;
        });
        return totalStarsCount;
    }
}
class BBPuzzlesMenu {
    constructor(game) {
        this.game = game;
        this.gameMode = 0;
        this._currentCoroutineId = 0;
        this.page = document.querySelector("#bb-puzzles-menu");
        this.machinesContainer = this.page.querySelector(".bb-puzzles-page-machines");
    }
    static FileNameToDisplayName(fileName) {
        let displayNameSplit = fileName.split("-");
        displayNameSplit = displayNameSplit.map(displayNameWord => {
            return displayNameWord.charAt(0).toLocaleUpperCase() + displayNameWord.slice(1);
        });
        let displayName = displayNameSplit.reduce((w1, w2) => { return w1 + " " + w2; });
        displayName = displayName.replace("Bouncermode", "(Bounce)");
        return displayName;
    }
    async initialize() {
        return new Promise(resolve => {
            this.page.onLoad = () => {
            };
        });
    }
    async redraw(page) {
        let coroutineId = this._currentCoroutineId + 1;
        this._currentCoroutineId = coroutineId;
        this.machinesContainer.innerHTML = "";
        let nPuzzle = 0;
        let nBonusPuzzle = 0;
        let w = this.page.clientWidth;
        let panelsPerLine = Math.max(Math.round(w / 165), 1);
        try {
            let data = {
                bbPuzzles: [],
                count: 0
            };
            for (let i = 1; i < BB_PUZZLES_LEVELS.length; i++) {
                let bbPuzzleData = await this.game.bbPuzzleLoader.getPuzzle(BB_PUZZLES_LEVELS[i], this.game.devMode.activated || this.game.DEBUG_MODE || true);
                if (bbPuzzleData) {
                    data.bbPuzzles.push(bbPuzzleData);
                    data.count++;
                }
            }
            if (this.gameMode === 0) {
                for (let i = 1; i < BB_PUZZLES_BONUS_LEVELS.length; i++) {
                    let bbPuzzleData = await this.game.bbPuzzleLoader.getPuzzle(BB_PUZZLES_BONUS_LEVELS[i], this.game.devMode.activated || this.game.DEBUG_MODE || true);
                    if (bbPuzzleData) {
                        bbPuzzleData.isBonus = true;
                        data.bbPuzzles.push(bbPuzzleData);
                        data.count++;
                    }
                }
            }
            let lineCount = Math.ceil(data.count / panelsPerLine);
            for (let i = 0; i < lineCount; i++) {
                let panelContainer = document.createElement("div");
                panelContainer.classList.add("puzzle-line");
                this.machinesContainer.appendChild(panelContainer);
                let panels = [];
                for (let j = 0; j < panelsPerLine; j++) {
                    let panel = document.createElement("button");
                    panel.classList.add("puzzle-tile");
                    panel.style.visibility = "hidden";
                    panelContainer.appendChild(panel);
                    panels[j] = panel;
                }
                for (let j = 0; j < panelsPerLine; j++) {
                    let panel = panels[j];
                    let puzzle = data.bbPuzzles[nPuzzle + nBonusPuzzle];
                    if (i === 0 && j === 0) {
                        panel.style.visibility = "";
                        let title1 = document.createElement("div");
                        title1.classList.add("title", "single-line");
                        panel.appendChild(title1);
                        title1.innerText = "進度";
                        let starCount = document.createElement("div");
                        starCount.classList.add("text");
                        starCount.innerHTML = "<span class='text-star'></span>&nbsp;&nbsp;" + this.game.bbPuzzle.progressPanel.totalCollectedStars + " / " + (3 * BB_PUZZLES_TOTAL_COUNT).toFixed(0) + "";
                        panel.appendChild(starCount);
                        let separator = document.createElement("div");
                        separator.classList.add("separator");
                        panel.appendChild(separator);
                        let title2 = document.createElement("div");
                        title2.classList.add("title", "single-line");
                        panel.appendChild(title2);
                        title2.innerText = "遊戲模式";
                        this.gameModeRailsButton = document.createElement("button");
                        //this.gameModeRailsButton.classList.add("selected");
                        this.gameModeRailsButton.innerText = "軌道";
                        this.gameModeRailsButton.onclick = () => { this.setGameMode(0); this.redraw(); };
                        panel.appendChild(this.gameModeRailsButton);
                        this.gameModeBouncerButton = document.createElement("button");
                        if (!this.game.bbPuzzle.progressPanel.bouncerModeUnlocked) {
                            this.gameModeBouncerButton.classList.add("disabled");
                        }
                        this.gameModeBouncerButton.innerText = "彈撞";
                        this.gameModeBouncerButton.onclick = () => { this.setGameMode(1); this.redraw(); };
                        panel.appendChild(this.gameModeBouncerButton);
                        if (!this.game.bbPuzzle.progressPanel.bouncerModeUnlocked) {
                            let lockInfo = document.createElement("div");
                            lockInfo.classList.add("text", "lock-info");
                            lockInfo.innerHTML = this.game.bbPuzzle.progressPanel.getBouncerModeCost().toFixed(0) + " <span class='text-star'></span> to unlock";
                            panel.appendChild(lockInfo);
                        }
                        this.setGameMode(this.gameMode);
                    }
                    else if (puzzle) {
                        panel.style.visibility = "";
                        panel.classList.add("selectable");
                        let title = document.createElement("div");
                        title.classList.add("title");
                        panel.appendChild(title);
                        title.innerHTML = BBPuzzlesMenu.FileNameToDisplayName(puzzle.machine.title);
                        if (this.gameMode === 1) {
                            title.innerHTML += " (Bouncer)";
                        }
                        if (this.game.devMode.activated || this.game.DEBUG_MODE) {
                            if (puzzle.solutionBallTrajectories.length === 0 || puzzle.solutionLines.length === 0) {
                                panel.classList.add("need-solution");
                            }
                            if (isNaN(puzzle.targetMaterial) || isNaN(puzzle.targetAirTime) || isNaN(puzzle.targetMaxSpeed)) {
                                panel.classList.add("need-solution");
                            }
                        }
                        let href = "";
                        if (puzzle.isBonus) {
                            panel.classList.add("puzzle-bonus");
                            href = "#bb-puzzle-bonus-" + (nBonusPuzzle + 1000 * this.gameMode + 1).toFixed(0);
                            nBonusPuzzle++;
                            if (this.game.bbPuzzle.progressPanel.isBonusLevelUnlocked(nBonusPuzzle)) {
                            }
                            else {
                                panel.classList.add("puzzle-locked");
                            }
                        }
                        else {
                            href = "#bb-puzzle-" + (nPuzzle + 1000 * this.gameMode + 1).toFixed(0);
                            nPuzzle++;
                        }
                        let miniature = Core.Machine.MakeMiniature(this.game.machine, puzzle.machine, { showGround: true, showInfoBox: false, backgroundColor: BABYLON.Color4.FromInts(32, 42, 52, 255).toHexString() });
                        if (miniature) {
                            panel.appendChild(miniature);
                            miniature.style.width = "calc(100% - 2px)";
                        }
                        else {
                            console.log("can't make miniature");
                            console.log(puzzle);
                        }
                        let score = document.createElement("div");
                        score.classList.add("score");
                        panel.appendChild(score);
                        let scoreValue = undefined;
                        if (puzzle.isBonus) {
                            scoreValue = this.game.bbPuzzleLoader.getScore(IndexToBBPuzzleLevel(nBonusPuzzle + 1000 * this.gameMode, true));
                        }
                        else {
                            scoreValue = this.game.bbPuzzleLoader.getScore(IndexToBBPuzzleLevel(nPuzzle + 1000 * this.gameMode, false));
                        }
                        if (scoreValue) {
                            for (let i = 0; i < scoreValue.stars; i++) {
                                let scoreMedal = document.createElement("span");
                                scoreMedal.classList.add("star", "xs");
                                score.appendChild(scoreMedal);
                            }
                            let scoreValueElement = document.createElement("span");
                            scoreValueElement.classList.add("value");
                            scoreValueElement.innerText = scoreValue.material.toFixed(1);
                            score.appendChild(scoreValueElement);
                        }
                        else {
                            let scoreValueElement = document.createElement("span");
                            scoreValueElement.classList.add("value");
                            score.appendChild(scoreValueElement);
                            scoreValueElement.innerText = "-";
                            if (puzzle.isBonus) {
                                if (this.game.bbPuzzle.progressPanel.isBonusLevelUnlocked(nBonusPuzzle)) {
                                }
                                else {
                                    scoreValueElement.innerHTML = this.game.bbPuzzle.progressPanel.getBonusLevelCost(nBonusPuzzle).toFixed(0) + " <span class='text-star'></span> to unlock";
                                }
                            }
                        }
                        panel.onclick = (ev) => {
                            location.href = href;
                        };
                    }
                    //await Nabu.Wait(1);
                    if (coroutineId != this._currentCoroutineId) {
                        return;
                    }
                }
            }
            let creditTitleContainer = document.createElement("div");
            creditTitleContainer.classList.add("puzzle-line");
            this.machinesContainer.appendChild(creditTitleContainer);
            creditTitleContainer.innerHTML = `
                <button class="puzzle-tile">
                    <div class="title">製作人員</div>
                    <div class="text">版本 ` + CONFIGURATION_VERSION.toFixed(0) + `</div>
                </button>
            `;
            let creditContainer = document.createElement("div");
            creditContainer.classList.add("puzzle-line");
            this.machinesContainer.appendChild(creditContainer);
            let creationCreditLine = `
                <div class="title">Creation - Sven Taton</div>
                <div class="text">Tiaratum Games</div>
                <div class="text">&nbsp;</div>
                <div class="text">tiaratum.com</div>
            `;
            let musicCreditLine = `
                <div class="title">Music - Scott Buckley</div>
                <div class="text">Track - ORIGAMI</div>
                <div class="text">CC-BY 4.0.</div>
                <div class="text">scottbuckley.com.au</div>
            `;
            let skyboxCreditLine = `
                <div class="title">Skybox - Paul</div>
                <div class="text">SkyBox In The Cloud</div>
                <div class="text">CC-BY 4.0.</div>
                <div class="text">sketchfab.com/paul_paul_paul</div>
            `;
            let toyCreditLine = `
                <div class="title">Animal Toys - Kenney</div>
                <div class="text">Cube Pets</div>
                <div class="text">CC-0.</div>
                <div class="text">kenney.nl</div>
            `;
            if (panelsPerLine < 6) {
                creditContainer.innerHTML += `
                    <button class="puzzle-tile">
                ` +
                    creationCreditLine +
                    `
                        <div style="height: 24px"></div>
                ` +
                    musicCreditLine +
                    `
                        <div style="height: 10px"></div>
                ` +
                    skyboxCreditLine +
                    `
                        <div style="height: 10px"></div>
                ` +
                    toyCreditLine +
                    `
                        <div style="height: 10px"></div>
                    </button>
                `;
            }
            else {
                creditContainer.innerHTML += `
                    <button class="puzzle-tile">
                ` +
                    creationCreditLine +
                    `
                        <div style="height: 10px"></div>
                    </button>
                    <button class="puzzle-tile">
                ` +
                    musicCreditLine +
                    `
                        <div style="height: 10px"></div>
                    </button>
                    <button class="puzzle-tile">
                ` +
                    skyboxCreditLine +
                    `
                        <div style="height: 10px"></div>
                    </button>
                    <button class="puzzle-tile">
                ` +
                    toyCreditLine +
                    `
                        <div style="height: 10px"></div>
                    </button>
                `;
            }
        }
        catch (e) {
            console.error(e);
        }
    }
    setGameMode(n) {
        this.gameMode = n;
        if (this.gameMode === 0) {
            this.gameModeRailsButton.classList.add("selected");
            this.gameModeBouncerButton.classList.remove("selected");
        }
        else if (this.gameMode === 1) {
            this.gameModeRailsButton.classList.remove("selected");
            this.gameModeBouncerButton.classList.add("selected");
        }
    }
}
async function DEV_CreatePuzzlePack() {
    let data = { bbPuzzles: [], count: 0 };
    for (let i = 1; i < BB_PUZZLES_LEVELS.length; i++) {
        let bbPuzzleDataString = await fetch("./datas/bb-puzzles/" + BB_PUZZLES_LEVELS[i] + ".json");
        if (bbPuzzleDataString && bbPuzzleDataString.status === 200) {
            let bbPuzzleData = (await bbPuzzleDataString.json());
            if (bbPuzzleData) {
                data.bbPuzzles.push(bbPuzzleData);
                data.count++;
            }
        }
    }
    Nabu.download("bb-puzzles-pack.json", JSON.stringify(data));
}
class CommunityMachine {
    constructor(name, href, imgSrc) {
        this.name = name;
        this.href = href;
        this.imgSrc = imgSrc;
    }
}
var CommunityMachines = [
    new CommunityMachine("Tiny Track", "#demo-tiny_track", "./datas/icons/demos/tiny_track.png"),
    new CommunityMachine("Simple", "#demo-simple", "./datas/icons/demos/simple.png"),
    new CommunityMachine("Tornado", "#demo-tornado", "./datas/icons/demos/tornado.png"),
    new CommunityMachine("Black & Red", "#demo-black_red", "./datas/icons/demos/black_red.png"),
    new CommunityMachine("Newton", "#demo-newton", "./datas/icons/demos/newton.png"),
    new CommunityMachine("Pavlita", "#demo-pavlita", "./datas/icons/demos/pavlita.png"),
    new CommunityMachine("Golden Loops", "#demo-golden_loops", "./datas/icons/demos/golden_loops.png"),
    new CommunityMachine("Aerials", "#demo-aerials", "./datas/icons/demos/aerials.png"),
    new CommunityMachine("Loopy Loops", "#demo-loopyloops", "./datas/icons/demos/loopyloops.png"),
    new CommunityMachine("Controller", "#demo-controller", "./datas/icons/demos/controller.png"),
    new CommunityMachine("Sisyphus", "#demo-sisyphus", "./datas/icons/demos/sisyphus.png"),
    new CommunityMachine("Sky Screw", "#demo-sky_screw", "./datas/icons/demos/sky_screw.png"),
    new CommunityMachine("Tangled", "#demo-tangled", "./datas/icons/demos/tangled.png"),
    new CommunityMachine("Elise", "#demo-elise", "./datas/icons/demos/elise.png"),
    new CommunityMachine("Cable Management", "#demo-cable_management", "./datas/icons/demos/cable_management.png"),
    new CommunityMachine("Pipe Machine", "#machine?id=1011366399", "./datas/icons/demos/1011366399.png"),
    new CommunityMachine("Great Ball Factory", "#machine?id=1037419437", "./datas/icons/demos/1037419437.png"),
    new CommunityMachine("Random", "#machine?id=1045213988", "./datas/icons/demos/1045213988.png"),
    new CommunityMachine("Double Loop", "#machine?id=1065551463", "./datas/icons/demos/1065551463.png"),
    new CommunityMachine("Forward Split", "#machine?id=1083269871", "./datas/icons/demos/1083269871.png"),
    new CommunityMachine("Spider Man", "#machine?id=1084538378", "./datas/icons/demos/1084538378.png"),
    new CommunityMachine("Thumbnail", "#machine?id=109759798", "./datas/icons/demos/109759798.png"),
    new CommunityMachine("Simple Track", "#machine?id=1098216871", "./datas/icons/demos/1098216871.png"),
    new CommunityMachine("Loop Factory", "#machine?id=1121098926", "./datas/icons/demos/1121098926.png"),
    new CommunityMachine("Cool Spiral", "#machine?id=112635266", "./datas/icons/demos/112635266.png"),
    new CommunityMachine("Tiny Track", "#machine?id=1147760102", "./datas/icons/demos/1147760102.png"),
    new CommunityMachine("Rohka", "#machine?id=116183920", "./datas/icons/demos/116183920.png"),
    new CommunityMachine("Thumbnail 2", "#machine?id=1163885088", "./datas/icons/demos/1163885088.png"),
    new CommunityMachine("Jump !", "#machine?id=1174810267", "./datas/icons/demos/1174810267.png"),
    new CommunityMachine("Ball View", "#machine?id=1190924914", "./datas/icons/demos/1190924914.png"),
    new CommunityMachine("Magnificient Steel Construction", "#machine?id=119707753", "./datas/icons/demos/119707753.png"),
    new CommunityMachine("Great Invention", "#machine?id=1239417218", "./datas/icons/demos/1239417218.png"),
    new CommunityMachine("Papu Arcoiris", "#machine?id=1240137851", "./datas/icons/demos/1240137851.png"),
    new CommunityMachine("Double Dudes", "#machine?id=1263268620", "./datas/icons/demos/1263268620.png"),
    new CommunityMachine("Rail", "#machine?id=1291185131", "./datas/icons/demos/1291185131.png"),
    new CommunityMachine("Spiral Computer", "#machine?id=129870986", "./datas/icons/demos/129870986.png"),
    new CommunityMachine("Istar", "#machine?id=1028445129", "./datas/icons/demos/1028445129.png"),
    new CommunityMachine("Crazy Skyscrapper", "#machine?id=1057066744", "./datas/icons/demos/1057066744.png"),
    new CommunityMachine("Complex Ball Machine", "#machine?id=1080442210", "./datas/icons/demos/1080442210.png"),
    new CommunityMachine("High", "#machine?id=1112816958", "./datas/icons/demos/1112816958.png"),
    new CommunityMachine("Dual Track Invention", "#machine?id=1114521751", "./datas/icons/demos/1114521751.png"),
    new CommunityMachine("Ball Crasher", "#machine?id=1188417201", "./datas/icons/demos/1188417201.png"),
    new CommunityMachine("Nice Curves", "#machine?id=128648852", "./datas/icons/demos/128648852.png"),
    new CommunityMachine("Marble Elimination", "#machine?id=1354595094", "./datas/icons/demos/1354595094.png"),
    new CommunityMachine("Great Ball Machine", "#machine?id=1506787238", "./datas/icons/demos/1506787238.png"),
    new CommunityMachine("Simple Steel Thing", "#machine?id=1541235966", "./datas/icons/demos/1541235966.png"),
    new CommunityMachine("Jump 2", "#machine?id=1574675071", "./datas/icons/demos/1574675071.png"),
    new CommunityMachine("Mundo Atualizado", "#machine?id=159311517", "./datas/icons/demos/159311517.png"),
    new CommunityMachine("Simple Factory", "#machine?id=1636037626", "./datas/icons/demos/1636037626.png"),
    new CommunityMachine("Boll vs Boll", "#machine?id=173731682", "./datas/icons/demos/173731682.png"),
    new CommunityMachine("Thomas2", "#machine?id=1831128321", "./datas/icons/demos/1831128321.png"),
    new CommunityMachine("So many balls", "#machine?id=1860833542", "./datas/icons/demos/1860833542.png"),
    new CommunityMachine("XXL Simple Invention", "#machine?id=1879543443", "./datas/icons/demos/1879543443.png"),
    new CommunityMachine("Colorful fast thing", "#machine?id=1981331230", "./datas/icons/demos/1981331230.png"),
    new CommunityMachine("Crash ball", "#machine?id=205085515", "./datas/icons/demos/205085515.png"),
    new CommunityMachine("Complex Ball", "#machine?id=270246581", "./datas/icons/demos/270246581.png"),
    new CommunityMachine("Intricated Construction", "#machine?id=391833206", "./datas/icons/demos/391833206.png"),
    new CommunityMachine("Race", "#machine?id=526082398", "./datas/icons/demos/526082398.png"),
    new CommunityMachine("Magnificent Machinery", "#machine?id=60338536", "./datas/icons/demos/60338536.png"),
    new CommunityMachine("Idk 1", "#machine?id=71300080", "./datas/icons/demos/71300080.png"),
    new CommunityMachine("Satisfying", "#machine?id=803787054", "./datas/icons/demos/803787054.png"),
    new CommunityMachine("Coszys Run", "#machine?id=873788647", "./datas/icons/demos/873788647.png"),
    new CommunityMachine("Complex Construction", "#machine?id=978383458", "./datas/icons/demos/978383458.png"),
    new CommunityMachine("The Great Loop Construction", "#machine?id=1065613958", "./datas/icons/demos/1065613958.png"),
    new CommunityMachine("Six Balls Saleem", "#machine?id=1098223916", "./datas/icons/demos/1098223916.png"),
    new CommunityMachine("Tiny Track", "#machine?id=1151683385", "./datas/icons/demos/1151683385.png"),
    new CommunityMachine("The Cool Curve Invention", "#machine?id=1373673405", "./datas/icons/demos/1373673405.png"),
    new CommunityMachine("The Little Marble Knot", "#machine?id=1482533838", "./datas/icons/demos/1482533838.png"),
    new CommunityMachine("A Great Spiral Thing", "#machine?id=1610947167", "./datas/icons/demos/1610947167.png"),
    new CommunityMachine("Our Great Track Invention", "#machine?id=1829378359", "./datas/icons/demos/1829378359.png"),
    new CommunityMachine("Our Simple Loop Thing", "#machine?id=2069619882", "./datas/icons/demos/2069619882.png"),
    new CommunityMachine("Intricated Toggle Construction", "#machine?id=660669939", "./datas/icons/demos/660669939.png"),
    new CommunityMachine("A very long marble run", "#machine?id=693716388", "./datas/icons/demos/693716388.png"),
    new CommunityMachine("My biggest Marble Run 3D", "#machine?id=696285248", "./datas/icons/demos/696285248.png"),
    new CommunityMachine("Diversi citi", "#machine?id=735772513", "./datas/icons/demos/735772513.png"),
    new CommunityMachine("um", "#machine?id=903374899", "./datas/icons/demos/903374899.png"),
    new CommunityMachine("Our Cool Race", "#machine?id=959738819", "./datas/icons/demos/959738819.png")
];
var ShowcasePageSortBy;
(function (ShowcasePageSortBy) {
    ShowcasePageSortBy[ShowcasePageSortBy["Id"] = 0] = "Id";
    ShowcasePageSortBy[ShowcasePageSortBy["Best"] = 1] = "Best";
    ShowcasePageSortBy[ShowcasePageSortBy["Latest"] = 2] = "Latest";
    ShowcasePageSortBy[ShowcasePageSortBy["Size"] = 3] = "Size";
})(ShowcasePageSortBy || (ShowcasePageSortBy = {}));
var ShowcasePageFilterRange;
(function (ShowcasePageFilterRange) {
    ShowcasePageFilterRange[ShowcasePageFilterRange["AllTime"] = 0] = "AllTime";
    ShowcasePageFilterRange[ShowcasePageFilterRange["Month"] = 1] = "Month";
    ShowcasePageFilterRange[ShowcasePageFilterRange["Week"] = 2] = "Week";
})(ShowcasePageFilterRange || (ShowcasePageFilterRange = {}));
class CommunityMenu {
    constructor(game) {
        this.game = game;
        this.sortByBtns = [];
        this.filterRangeBtns = [];
        this.sortByAsc = false;
        this.filterRangeIsDefault = true;
        this.pageNum = 1;
        this.maxPageNum = 1;
        this.machinesPerPage = 20;
        this._currentCoroutineId = 0;
        this.page = document.querySelector("#community-menu");
        this.sortByBtns[ShowcasePageSortBy.Best] = this.page.querySelector("#machine-page-filter-best");
        this.sortByBtns[ShowcasePageSortBy.Latest] = this.page.querySelector("#machine-page-filter-latest");
        this.sortByBtns[ShowcasePageSortBy.Size] = this.page.querySelector("#machine-page-filter-size");
        this.filterRangeBtns[ShowcasePageFilterRange.AllTime] = this.page.querySelector("#machine-page-filter-all-time");
        this.filterRangeBtns[ShowcasePageFilterRange.Month] = this.page.querySelector("#machine-page-filter-month");
        this.filterRangeBtns[ShowcasePageFilterRange.Week] = this.page.querySelector("#machine-page-filter-week");
        this.machinesContainer = this.page.querySelector(".machine-page-machines");
        this.pagePrevBtn = this.page.querySelector(".machine-page-prev");
        this.pageNextBtn = this.page.querySelector(".machine-page-next");
        this.pageNumText = this.page.querySelector(".machine-page-page-num");
        document.querySelector("#machine-page-server-status-container").onclick = () => {
            this.game.checkLiveServiceAvailability();
        };
        this.setSortByValue(ShowcasePageSortBy.Best, false);
        this.setFilterRangeValue(ShowcasePageFilterRange.Week);
        this.filterRangeIsDefault = true;
    }
    async initialize() {
        return new Promise(resolve => {
            this.page.onLoad = () => {
                this.pagePrevBtn.onclick = () => {
                    let pageNum = Math.max(1, this.pageNum - 1);
                    location.href = "#community?page=" + pageNum.toFixed(0);
                };
                this.pageNextBtn.onclick = () => {
                    let pageNum = Math.min(this.maxPageNum, this.pageNum + 1);
                    location.href = "#community?page=" + pageNum.toFixed(0);
                };
                for (let v = ShowcasePageSortBy.Best; v <= ShowcasePageSortBy.Size; v++) {
                    let vv = v;
                    this.sortByBtns[vv].onclick = () => {
                        let asc = !this.sortByAsc && (vv === this.sortBy);
                        this.setSortByValue(vv, asc);
                        if (this.pageNum != 1) {
                            location.href = "#community?page=1";
                        }
                        else {
                            this.redraw(1);
                        }
                    };
                }
                for (let v = ShowcasePageFilterRange.AllTime; v <= ShowcasePageFilterRange.Week; v++) {
                    let vv = v;
                    this.filterRangeBtns[vv].onclick = () => {
                        this.setFilterRangeValue(vv);
                        this.filterRangeIsDefault = false;
                        if (this.pageNum != 1) {
                            location.href = "#community?page=1";
                        }
                        else {
                            this.redraw(1);
                        }
                    };
                }
            };
        });
    }
    setSortByValue(v, asc) {
        this.sortBy = v;
        this.sortByAsc = asc;
        this.sortByBtns.forEach(btn => {
            btn.classList.remove("active");
            btn.querySelector(".sort-asc").style.display = "none";
            btn.querySelector(".sort-desc").style.display = "none";
        });
        this.sortByBtns[this.sortBy].classList.add("active");
        if (this.sortByAsc) {
            this.sortByBtns[this.sortBy].querySelector(".sort-asc").style.display = "inline";
        }
        else {
            this.sortByBtns[this.sortBy].querySelector(".sort-desc").style.display = "inline";
        }
    }
    setFilterRangeValue(v) {
        this.filterRange = v;
        this.filterRangeBtns.forEach(btn => {
            btn.classList.remove("active");
        });
        this.filterRangeBtns[this.filterRange].classList.add("active");
    }
    async redraw(page) {
        let coroutineId = this._currentCoroutineId + 1;
        this._currentCoroutineId = coroutineId;
        if (isFinite(page)) {
            this.pageNum = Math.min(page, this.maxPageNum);
        }
        this.machinesContainer.innerHTML = "";
        let n = 0;
        let lineCount = 5;
        let w = this.page.clientWidth;
        let panelsPerLine = Math.max(Math.round(w / 165), 1);
        this.machinesPerPage = lineCount * panelsPerLine;
        while (this.machinesPerPage < 20) {
            lineCount++;
            this.machinesPerPage = lineCount * panelsPerLine;
        }
        try {
            let state = 1 << Core.MachineDBState.Ok | 1 << Core.MachineDBState.Star;
            let headers = {};
            if (this.game.devMode.activated) {
                state = 0;
                for (let s = Core.MachineDBState.Pending; s <= Core.MachineDBState.Star; s++) {
                    if (this.game.devMode.filterMachines[s]) {
                        state |= 1 << s;
                    }
                }
                headers = {
                    "Authorization": 'Basic ' + btoa("carillon:" + this.game.devMode.getPassword())
                };
            }
            let sortValue = this.sortBy + (this.sortByAsc ? 4 : 0);
            let dateRangeValue = 0;
            if (this.filterRange === ShowcasePageFilterRange.AllTime) {
                dateRangeValue = 0;
            }
            else if (this.filterRange === ShowcasePageFilterRange.Month) {
                dateRangeValue = 31;
            }
            else if (this.filterRange === ShowcasePageFilterRange.Week) {
                dateRangeValue = 8;
            }
            let data;
            if (this.game.OFFLINE_MODE) {
                data = await this.game.offlineDatabase.offlineFetch(this.pageNum - 1, this.machinesPerPage, sortValue);
            }
            else {
                let dataResponse = await fetch(SHARE_SERVICE_PATH + "get_machines/" + (this.pageNum - 1).toFixed(0) + "/" + this.machinesPerPage.toFixed(0) + "/" + state + "/" + sortValue.toFixed(0) + "/" + dateRangeValue.toFixed(0), {
                    method: "GET",
                    mode: "cors",
                    headers: headers
                });
                let dataText = await dataResponse.text();
                data = JSON.parse(dataText);
            }
            // If weekly page has no enough machines, switch to monthly
            if (this.filterRangeIsDefault && this.filterRange === ShowcasePageFilterRange.Week && data.count < 18) {
                this.setFilterRangeValue(ShowcasePageFilterRange.Month);
                this.redraw(1);
                return;
            }
            // If monthly page has no enough machines, switch to alltime
            if (this.filterRangeIsDefault && this.filterRange === ShowcasePageFilterRange.Month && data.count < 36) {
                this.setFilterRangeValue(ShowcasePageFilterRange.AllTime);
                this.redraw(1);
                return;
            }
            this.maxPageNum = Math.ceil(data.count / this.machinesPerPage);
            this.pageNumText.innerText = this.pageNum.toFixed(0) + " / " + this.maxPageNum.toFixed(0);
            if (this.game.devMode.activated) {
                this.game.devMode.lastQueriedIds = [];
                this.game.devMode.lastQueriedIds = data.machines.map((m) => {
                    if (m) {
                        return m.id;
                    }
                });
            }
            // If sorted by Best, include Star machines
            /*
            if (this.sortBy === ShowcasePageSortBy.Best && this.sortByAsc === false && this.pageNum === 1) {
                let dataResponse = await fetch(SHARE_SERVICE_PATH + "get_machines/0/100/" + (1 << Core.MachineDBState.Star).toFixed(0) + "/" + sortValue.toFixed(0) + "/0", {
                    method: "GET",
                    mode: "cors",
                    headers: headers
                });
                let dataText = await dataResponse.text();
                let starMachinesData = JSON.parse(dataText);
                let count = Math.min(2, starMachinesData.machines.length);
                let m = Math.floor(Date.now() / 1000 / 60);
                for (let i = 0; i < count; i++) {
                    let starMachine = starMachinesData.machines[(i + m) % starMachinesData.machines.length];
                    if (starMachine) {
                        if (!data.machines.find(m => { return m.id === starMachine.id; })) {
                            data.machines.splice(0, 0, starMachine);
                        }
                    }
                }
                lineCount++;
            }
            */
            for (let i = 0; i < lineCount; i++) {
                let panelContainer = document.createElement("div");
                panelContainer.classList.add("machine-line");
                this.machinesContainer.appendChild(panelContainer);
                let panels = [];
                for (let j = 0; j < panelsPerLine; j++) {
                    let panel = document.createElement("button");
                    panel.classList.add("machine-tile");
                    panel.style.visibility = "hidden";
                    panelContainer.appendChild(panel);
                    panels[j] = panel;
                }
                for (let j = 0; j < panelsPerLine; j++) {
                    let panel = panels[j];
                    let machine = data.machines[n];
                    if (machine) {
                        panel.style.visibility = "";
                        let title = document.createElement("div");
                        title.classList.add("title");
                        panel.appendChild(title);
                        title.innerText = machine.title;
                        let machineId = document.createElement("div");
                        machineId.classList.add("machine-id");
                        if (isFinite(machine.id)) {
                            machineId.innerHTML = "編號" + machine.id.toFixed(0);
                        }
                        panel.appendChild(machineId);
                        let href = "#machine?id=" + machine.id.toFixed(0);
                        n++;
                        let miniature = Core.Machine.MakeMiniature(this.game.machine, machine, { showGround: true, showInfoBox: false, backgroundColor: BABYLON.Color4.FromInts(39, 43, 46, 128).toHexString() });
                        if (miniature) {
                            panel.appendChild(miniature);
                            miniature.style.width = "100%";
                        }
                        else {
                            console.log("can't make miniature");
                            console.log(machine);
                        }
                        let countryCode = "xx";
                        if (machine.country) {
                            countryCode = machine.country;
                        }
                        let countryIcon = document.createElement("span");
                        countryIcon.classList.add("country", "fi", "fi-" + countryCode);
                        let flag = ExistingCountryFlags.find(f => { return f.code === countryCode; });
                        if (flag) {
                            countryIcon.title = flag.name;
                        }
                        panel.appendChild(countryIcon);
                        let author = document.createElement("div");
                        author.classList.add("author");
                        panel.appendChild(author);
                        if (machine.author) {
                            author.innerHTML = machine.author;
                        }
                        else {
                            author.innerHTML = "匿名";
                        }
                        let likes = document.createElement("div");
                        likes.classList.add("likes");
                        panel.appendChild(likes);
                        let displayedLikes = machine.likes + Core.Machine.CreationStringToExtraLikes(machine.creation);
                        likes.innerText = displayedLikes.toFixed(0);
                        let likeIcon = document.createElement("img");
                        if (this.game.likeManager.isLiked(machine.id)) {
                            likeIcon.src = "./datas/icons-mrs/like.svg";
                        }
                        else {
                            likeIcon.src = "./datas/icons-mrs/like-stroked.svg";
                        }
                        likes.appendChild(likeIcon);
                        let creationDate = document.createElement("div");
                        creationDate.classList.add("creation-date");
                        panel.appendChild(creationDate);
                        if (machine.creation) {
                            if (this.game.devMode.activated) {
                                creationDate.innerHTML = machine.creation.split(" ").reduce((l1, l2) => { return l1 + "</br>" + l2; });
                            }
                            else {
                                creationDate.innerHTML = machine.creation.split(" ")[0];
                            }
                        }
                        if (machine.state === 5) {
                            let star = document.createElement("div");
                            star.classList.add("star");
                            star.innerHTML = "&starf;";
                            panel.appendChild(star);
                        }
                        panel.onclick = (ev) => {
                            location.href = href;
                        };
                        if (this.game.devMode.activated) {
                            let deleteBtnsLabels = ["...", "OK", "X", "!", "?", "OK+"];
                            let dbStateInfo = document.createElement("div");
                            dbStateInfo.innerText = Core.MachineDBStateStrings[machine.state];
                            dbStateInfo.classList.add("db-state-info");
                            dbStateInfo.classList.add(Core.MachineDBStateStrings[machine.state].replace("+", "p").toLocaleLowerCase());
                            panel.appendChild(dbStateInfo);
                            if (machine.duplicate > 0) {
                                let dbDuplicate = document.createElement("div");
                                dbDuplicate.innerText = "重複";
                                dbDuplicate.classList.add("db-duplicate-info");
                                panel.appendChild(dbDuplicate);
                            }
                            for (let k = Core.MachineDBState.Pending; k <= Core.MachineDBState.Star; k++) {
                                let kk = k;
                                let devStateBtn = document.createElement("button");
                                devStateBtn.innerText = deleteBtnsLabels[kk];
                                devStateBtn.classList.add("state-btn");
                                let id = machine.id;
                                devStateBtn.onclick = async (ev) => {
                                    ev.stopPropagation();
                                    if (isFinite(id)) {
                                        let data = {
                                            id: id,
                                            state: kk
                                        };
                                        let dataString = JSON.stringify(data);
                                        const response = await fetch(SHARE_SERVICE_PATH + "set_machine_state", {
                                            method: "POST",
                                            mode: "cors",
                                            headers: {
                                                "Authorization": 'Basic ' + btoa("carillon:" + this.game.devMode.getPassword())
                                            },
                                            body: dataString,
                                        });
                                        dbStateInfo.classList.remove("pending", "ok", "okp", "nok", "problem", "info");
                                        dbStateInfo.classList.add(Core.MachineDBStateStrings[kk].replace("+", "p").toLocaleLowerCase());
                                        dbStateInfo.innerText = Core.MachineDBStateStrings[kk];
                                    }
                                };
                                devStateBtn.style.right = (104 - k * 20).toFixed(0) + "px";
                                panel.appendChild(devStateBtn);
                            }
                        }
                    }
                    await Nabu.Wait(1);
                    if (coroutineId != this._currentCoroutineId) {
                        return;
                    }
                }
            }
        }
        catch (e) {
            console.error(e);
        }
    }
}
class ConstructionModeView extends HTMLElement {
    constructor() {
        super(...arguments);
        this._loaded = false;
        this._shown = false;
        this.selectedMode = Core.MachineConstructionMode.Mode2D;
        this._timer = 0;
    }
    static get observedAttributes() {
        return [];
    }
    get loaded() {
        return this._loaded;
    }
    get shown() {
        return this._shown;
    }
    setSelectedMode(mode) {
        this.selectedMode = mode;
        if (this.selectedMode === Core.MachineConstructionMode.Mode3D) {
            this._button2D.classList.remove("selected");
            this._button3D.classList.add("selected");
        }
        else if (this.selectedMode === Core.MachineConstructionMode.Mode2D) {
            this._button2D.classList.add("selected");
            this._button3D.classList.remove("selected");
        }
    }
    setRecommandedMode(mode) {
        let recommended = document.createElement("div");
        recommended.classList.add("recommended");
        recommended.innerHTML = "（建議）";
        if (mode === Core.MachineConstructionMode.Mode3D) {
            this._button3D.appendChild(recommended);
            this._container.insertBefore(this._panel3D, this._panel2D);
        }
        else if (mode === Core.MachineConstructionMode.Mode2D) {
            this._button2D.appendChild(recommended);
            this._container.insertBefore(this._panel2D, this._panel3D);
        }
    }
    async waitLoaded() {
        return new Promise(resolve => {
            let wait = () => {
                if (this._loaded) {
                    resolve();
                }
                else {
                    requestAnimationFrame(wait);
                }
            };
            wait();
        });
    }
    get onLoad() {
        return this._onLoad;
    }
    set onLoad(callback) {
        this._onLoad = callback;
        if (this._loaded) {
            this._onLoad();
        }
    }
    connectedCallback() {
        this.style.display = "none";
        this.style.opacity = "0";
        this.addEventListener("pointerdown", StopPointerProgatation);
        this.addEventListener("pointermove", StopPointerProgatation);
        this.addEventListener("pointerup", StopPointerProgatationAndMonkeys);
        this._title = document.createElement("h1");
        this._title.innerHTML = "機械建造工具";
        this.appendChild(this._title);
        this._container = document.createElement("div");
        this.appendChild(this._container);
        let intro = document.createElement("p");
        intro.innerHTML = "選擇編輯器的建造模式。";
        this._container.appendChild(intro);
        this._panel3D = document.createElement("div");
        this._panel3D.classList.add("construction-mode-panel");
        this._container.appendChild(this._panel3D);
        this._button3D = document.createElement("div");
        this._button3D.classList.add("construction-mode-button");
        this._panel3D.appendChild(this._button3D);
        let title3D = document.createElement("h2");
        title3D.innerHTML = "3D 模式";
        this._button3D.appendChild(title3D);
        let icon3D = document.createElement("img");
        icon3D.src = "datas/icons-mrs/construction-mode-3D.png";
        this._button3D.appendChild(icon3D);
        let label3D_1 = document.createElement("p");
        label3D_1.innerHTML = "完整功能";
        this._panel3D.appendChild(label3D_1);
        let label3D_2 = document.createElement("p");
        label3D_2.innerHTML = "適合電腦";
        this._panel3D.appendChild(label3D_2);
        this._panel2D = document.createElement("div");
        this._panel2D.classList.add("construction-mode-panel");
        this._container.appendChild(this._panel2D);
        this._button2D = document.createElement("div");
        this._button2D.classList.add("construction-mode-button");
        this._panel2D.appendChild(this._button2D);
        let title2D = document.createElement("h2");
        title2D.innerHTML = "2D 模式";
        this._button2D.appendChild(title2D);
        let icon2D = document.createElement("img");
        icon2D.src = "datas/icons-mrs/construction-mode-2D.png";
        this._button2D.appendChild(icon2D);
        let label2D_1 = document.createElement("p");
        label2D_1.innerHTML = "操作簡單";
        this._panel2D.appendChild(label2D_1);
        let label2D_2 = document.createElement("p");
        label2D_2.innerHTML = "適合手機";
        this._panel2D.appendChild(label2D_2);
        //let label2D_3 = document.createElement("p");
        //label2D_3.innerHTML = "Build in the vertical plane";
        //this._panel2D.appendChild(label2D_3);
        let buildButton = document.createElement("button");
        buildButton.classList.add("large-button", "hide-in-low-res");
        buildButton.innerHTML = "開始建造！";
        this._container.appendChild(buildButton);
        this._button2D.onclick = () => {
            if (this.selectedMode === Core.MachineConstructionMode.Mode2D) {
                location.hash = "#editor";
            }
            this.setSelectedMode(Core.MachineConstructionMode.Mode2D);
        };
        this._button3D.onclick = () => {
            if (this.selectedMode === Core.MachineConstructionMode.Mode3D) {
                location.hash = "#editor";
            }
            this.setSelectedMode(Core.MachineConstructionMode.Mode3D);
        };
        buildButton.onclick = () => {
            location.hash = "#editor";
        };
        this._loaded = true;
    }
    attributeChangedCallback(name, oldValue, newValue) { }
    async show(duration = 0.3) {
        this.game.popupShade.style.display = "";
        this.game.popupShade.style.opacity = "0.5";
        return new Promise((resolve) => {
            if (!this._shown) {
                this._shown = true;
                this.style.display = "block";
                let opacity0 = parseFloat(this.style.opacity);
                let opacity1 = 1;
                let t0 = performance.now();
                let step = () => {
                    let t = performance.now();
                    let dt = (t - t0) / 1000;
                    if (dt >= duration) {
                        this.style.opacity = "1";
                        //this.game.eulaPage.show(0);
                        PokiGameplayStop();
                        resolve();
                    }
                    else {
                        let f = dt / duration;
                        this.style.opacity = ((1 - f) * opacity0 + f * opacity1).toFixed(2);
                        requestAnimationFrame(step);
                    }
                };
                step();
            }
        });
    }
    async hide(duration = 0.3) {
        if (duration === 0) {
            this.game.popupShade.style.opacity = "0";
            this.game.popupShade.style.display = "none";
            if (this._shown) {
                PokiGameplayStart();
            }
            this._shown = false;
            this.style.display = "none";
            this.style.opacity = "0";
        }
        else {
            this.game.popupShade.style.opacity = "0";
            setTimeout(() => {
                this.game.popupShade.style.display = "none";
            }, duration * 1000);
            return new Promise((resolve) => {
                if (this._shown) {
                    if (this._shown) {
                        PokiGameplayStart();
                    }
                    this._shown = false;
                    this.style.display = "block";
                    let opacity0 = parseFloat(this.style.opacity);
                    let opacity1 = 0;
                    let t0 = performance.now();
                    let step = () => {
                        let t = performance.now();
                        let dt = (t - t0) / 1000;
                        if (dt >= duration) {
                            this.style.display = "none";
                            this.style.opacity = "0";
                            if (this.onNextHide) {
                                this.onNextHide();
                                this.onNextHide = undefined;
                            }
                            resolve();
                        }
                        else {
                            let f = dt / duration;
                            this.style.opacity = ((1 - f) * opacity0 + f * opacity1).toFixed(2);
                            requestAnimationFrame(step);
                        }
                    };
                    step();
                }
            });
        }
    }
    setGame(game) {
        this.game = game;
        if (this.game.devMode.activated) {
        }
    }
    update(dt) {
        if (this._timer > 0) {
            this._timer -= dt;
        }
    }
}
customElements.define("construction-mode-menu", ConstructionModeView);
class ExportMenuView extends HTMLElement {
    constructor() {
        super(...arguments);
        this._loaded = false;
        this._shown = false;
        this._shareBtnDefaultHTML = "";
        this._shareBtnWorkingHTML = "";
        this.currentPointers = 0;
        this._communicating = false;
        this._exportBallAccepted = false;
        this._timer = 0;
    }
    static get observedAttributes() {
        return [];
    }
    get loaded() {
        return this._loaded;
    }
    get shown() {
        return this._shown;
    }
    async waitLoaded() {
        return new Promise(resolve => {
            let wait = () => {
                if (this._loaded) {
                    resolve();
                }
                else {
                    requestAnimationFrame(wait);
                }
            };
            wait();
        });
    }
    get onLoad() {
        return this._onLoad;
    }
    set onLoad(callback) {
        this._onLoad = callback;
        if (this._loaded) {
            this._onLoad();
        }
    }
    currentPointerUp() {
        if (this._options.length > 0) {
            this.setPointer((this.currentPointers - 1 + this._options.length) % this._options.length);
        }
    }
    currentPointerDown() {
        if (this._options.length > 0) {
            this.setPointer((this.currentPointers + 1) % this._options.length);
        }
    }
    setPointer(n) {
        if (this._options[this.currentPointers]) {
            this._options[this.currentPointers].classList.remove("highlit");
        }
        this.currentPointers = n;
        if (this._options[this.currentPointers]) {
            this._options[this.currentPointers].classList.add("highlit");
        }
    }
    connectedCallback() {
        this.classList.add("popup-menu");
        this.style.display = "none";
        this.style.opacity = "0";
        this.addEventListener("pointerdown", StopPointerProgatation);
        this.addEventListener("pointermove", StopPointerProgatation);
        this.addEventListener("pointerup", StopPointerProgatationAndMonkeys);
        this._title = document.createElement("h1");
        this._title.classList.add("share-menu-title");
        this._title.innerHTML = '匯出';
        this.appendChild(this._title);
        let container;
        container = document.createElement("div");
        this.appendChild(container);
        this._shareInfo = document.createElement("div");
        this._shareInfo.innerHTML = `
            <p>此功能開發中。</p>
            <p>按下方「匯出」，可將你的機械下載為 .gltf 與 .bin 檔案。</p>
            <p>請注意：大型機械匯出時可能當機，使用前請先儲存作品！</p>
        `;
        container.appendChild(this._shareInfo);
        this._exportBallLine = document.createElement("div");
        this._exportBallLine.classList.add("line");
        this.exportBallCheckbox = document.createElement("nabu-checkbox");
        this.exportBallCheckbox.value = 0;
        this.exportBallCheckbox.onChange = () => {
            this.setExportBallAccepted(this.exportBallCheckbox.value === 1);
        };
        this._exportBallLine.appendChild(this.exportBallCheckbox);
        let exportBallLabel = document.createElement("span");
        exportBallLabel.classList.add("label");
        exportBallLabel.innerHTML = ' 包含彈珠';
        this._exportBallLine.appendChild(exportBallLabel);
        container.appendChild(this._exportBallLine);
        this._exportBtn = document.createElement("button");
        this._exportBtn.classList.add("large-button");
        this._shareBtnDefaultHTML = '匯出' + `&nbsp;&nbsp;&nbsp;<span style="font-weight: 100">(.gltf)</span>`;
        this._shareBtnWorkingHTML = '<i18n-text text-key="share-menu-btn-comm"></i18n-text>';
        this._exportBtn.innerHTML = this._shareBtnDefaultHTML;
        container.appendChild(this._exportBtn);
        this._exportBtn.onclick = async () => {
            const options = {
                // Function to indicate whether a Babylon node in the scene should be exported or not.
                shouldExportNode: (node) => {
                    if (node instanceof Core.MachinePart) {
                        return true;
                    }
                    if (node.name === "wire") {
                        return true;
                    }
                    if (node.name === "pipetrack-rings-mesh") {
                        return true;
                    }
                    if (node.name === "pipetrack-tube-mesh") {
                        return true;
                    }
                    if (this._exportBallAccepted && node.name === "ball") {
                        return true;
                    }
                    if (node.parent instanceof Core.MachinePart || node.parent && node.parent.parent instanceof Core.MachinePart) {
                        if (node.name != "machine-part-selector" && node.name != "endpoint-selector" && node.name != "enclose-mesh" && !node.name.startsWith("collider-") && !node.name.startsWith("selector-")) {
                            return true;
                        }
                    }
                    return false;
                },
                // Function to indicate whether an animation in the scene should be exported or not.
                shouldExportAnimation: (animation) => {
                    return false;
                },
                exportWithoutWaitingForScene: true,
                meshCompressionMethod: "None",
            };
            let data = await BABYLON["GLTF2Export"].GLTFAsync(this.game.scene, "my-construction_" + (Math.random() * 100000).toFixed(0), options);
            data.downloadFiles();
        };
        this._errorMessage = document.createElement("div");
        this._errorMessage.classList.add("error-message");
        this._errorMessage.style.display = "none";
        this._errorMessage.innerHTML = `
            <i18n-text text-key="share-menu-error"></i18n-text>
        `;
        container.appendChild(this._errorMessage);
        this._saveInfo = document.createElement("div");
        //this._saveInfo.innerHTML = `
        //    <p><i18n-text text-key="share-menu-save-notice"></i18n-text></p>
        //`;
        container.appendChild(this._saveInfo);
        this._shareMessage = document.createElement("div");
        this._shareMessage.innerHTML = '<p><i18n-text text-key="share-menu-outro"></i18n-text></p>';
        container.appendChild(this._shareMessage);
        let bottomLine = document.createElement("div");
        bottomLine.style.width = "100%";
        bottomLine.style.textAlign = "center";
        this._returnBtn = document.createElement("button");
        this._returnBtn.classList.add("medium-button");
        this._returnBtn.innerHTML = '<i18n-text text-key="btn-back"></i18n-text>';
        bottomLine.appendChild(this._returnBtn);
        this._returnBtn.onclick = () => {
            this.hide(0.1);
        };
        container.appendChild(bottomLine);
        this._loaded = true;
        this._options = [
            this._exportBtn,
            this._returnBtn
        ];
    }
    attributeChangedCallback(name, oldValue, newValue) { }
    async show(duration = 0.3) {
        this.game.popupShade.style.display = "block";
        this.game.popupShade.style.opacity = "0.5";
        return new Promise((resolve) => {
            if (!this._shown) {
                this._shown = true;
                this.style.display = "block";
                this.reset();
                let opacity0 = parseFloat(this.style.opacity);
                let opacity1 = 1;
                let t0 = performance.now();
                let step = () => {
                    let t = performance.now();
                    let dt = (t - t0) / 1000;
                    if (dt >= duration) {
                        this.style.opacity = "1";
                        //this.game.eulaPage.show(0);
                        PokiGameplayStop();
                        resolve();
                    }
                    else {
                        let f = dt / duration;
                        this.style.opacity = ((1 - f) * opacity0 + f * opacity1).toFixed(2);
                        requestAnimationFrame(step);
                    }
                };
                step();
            }
        });
    }
    async hide(duration = 0.3) {
        if (duration === 0) {
            this.game.popupShade.style.opacity = "0";
            this.game.popupShade.style.display = "none";
            if (this._shown) {
                PokiGameplayStart();
            }
            this._shown = false;
            this.style.display = "none";
            this.style.opacity = "0";
        }
        else {
            this.game.popupShade.style.opacity = "0";
            setTimeout(() => {
                this.game.popupShade.style.display = "none";
            }, duration * 1000);
            return new Promise((resolve) => {
                if (this._shown) {
                    if (this._shown) {
                        PokiGameplayStart();
                    }
                    this._shown = false;
                    this.style.display = "block";
                    let opacity0 = parseFloat(this.style.opacity);
                    let opacity1 = 0;
                    let t0 = performance.now();
                    let step = () => {
                        let t = performance.now();
                        let dt = (t - t0) / 1000;
                        if (dt >= duration) {
                            this.style.display = "none";
                            this.style.opacity = "0";
                            if (this.onNextHide) {
                                this.onNextHide();
                                this.onNextHide = undefined;
                            }
                            resolve();
                        }
                        else {
                            let f = dt / duration;
                            this.style.opacity = ((1 - f) * opacity0 + f * opacity1).toFixed(2);
                            requestAnimationFrame(step);
                        }
                    };
                    step();
                }
            });
        }
    }
    setExportBallAccepted(v) {
        this._exportBallAccepted = v;
    }
    setGame(game) {
        this.game = game;
    }
    update(dt) {
        if (this._timer > 0) {
            this._timer -= dt;
        }
    }
    reset() {
        this.updateStatus();
    }
    updateStatus() {
        this._errorMessage.style.display = "none";
        this._shareInfo.style.display = "block";
        this._saveInfo.style.display = "block";
        this._exportBtn.style.display = "block";
        this._returnBtn.style.display = "inline-block";
        this._shareMessage.style.display = "none";
    }
}
customElements.define("export-menu", ExportMenuView);
class HighlightArrow extends BABYLON.Mesh {
    constructor(name, game, baseSize = 0.1, distanceFromTarget = 0, dir) {
        super(name);
        this.game = game;
        this.baseSize = baseSize;
        this.dir = dir;
        this.AlphaAnimation = Mummu.AnimationFactory.EmptyNumberCallback;
        this._animationSlideInterval = 0;
        this._update = () => {
            if (this.dir && this.isVisible) {
                let y = this.position.subtract(this.game.arcCamera.globalPosition);
                Mummu.QuaternionFromYZAxisToRef(y, this.dir, this.rotationQuaternion);
            }
        };
        this.arrowMesh = new BABYLON.Mesh("arrow");
        this.arrowMesh.parent = this;
        this.arrowMesh.position.z = -distanceFromTarget;
        this.arrowMesh.material = game.materials.whiteFullLitMaterial;
        this.arrowMesh.scaling.copyFromFloats(this.baseSize, this.baseSize, this.baseSize);
        this.arrowMesh.visibility = 0;
        if (this.dir) {
            this.rotationQuaternion = BABYLON.Quaternion.Identity();
        }
        this.AlphaAnimation = Mummu.AnimationFactory.CreateNumber(this.arrowMesh, this.arrowMesh, "visibility");
    }
    get size() {
        return this.arrowMesh.scaling.x / this.baseSize;
    }
    set size(v) {
        let s = v * this.baseSize;
        this.arrowMesh.scaling.copyFromFloats(s, s, s);
    }
    async instantiate() {
        let datas = await this.game.vertexDataLoader.get("./datas/meshes/highlight-arrow.babylon");
        if (datas && datas[0]) {
            let data = datas[0];
            data.applyToMesh(this.arrowMesh);
        }
        this.game.scene.onBeforeRenderObservable.add(this._update);
    }
    show(duration) {
        return this.AlphaAnimation(0.7, duration);
    }
    hide(duration) {
        return this.AlphaAnimation(0, duration);
    }
    async slide(target, targetDir, duration = 1, easing) {
        return new Promise(resolve => {
            clearInterval(this._animationSlideInterval);
            let p0 = this.position.clone();
            let dir0 = this.dir.clone();
            let t0 = performance.now() / 1000;
            this._animationSlideInterval = setInterval(() => {
                let t = performance.now() / 1000 - t0;
                if (t >= duration) {
                    clearInterval(this._animationSlideInterval);
                    this.position.copyFrom(target);
                    resolve();
                }
                else {
                    let f = t / duration;
                    if (easing) {
                        f = easing(f);
                    }
                    BABYLON.Vector3.LerpToRef(p0, target, f, this.position);
                    BABYLON.Vector3.LerpToRef(dir0, targetDir, f, this.dir);
                    if (this.dir.length() > 0) {
                        this.dir.normalize();
                    }
                    else {
                        this.dir.copyFromFloats(0, -1, 0);
                    }
                }
            }, 15);
        });
    }
    dispose() {
        clearInterval(this._animationSlideInterval);
        super.dispose();
        this.game.scene.onBeforeRenderObservable.removeCallback(this._update);
    }
}
class HomeMenu {
    constructor(game) {
        this.game = game;
        this.tutorialIndex = 0;
        this.tutorialCount = 0;
        this.arcadeIndex = 0;
        this.arcadeCount = 0;
        this.puzzleIndex = 0;
        this.puzzleCount = 0;
        this.page = document.querySelector("#home-menu");
    }
    async initialize() {
        return new Promise(resolve => {
            this.page.onLoad = async () => {
                this.tutorialContainer = document.querySelector("#tutorial-container");
                this.tutorialCount = this.tutorialContainer.querySelectorAll(".medium-panel").length;
                this.tutorialContainer.querySelectorAll(".medium-panel").forEach(async (tutoPanel, index) => {
                    if (tutoPanel instanceof HTMLElement) {
                        let tutorialName = TutorialsList[index];
                        tutoPanel.querySelector(".label").innerHTML = "<i18n-text text-key='tutorial-" + tutorialName + "-title'></i18n-text> " + (index + 1).toFixed(0);
                        tutoPanel.querySelector(".label-2 i18n-text").setAttribute("text-key", "tutorial-" + tutorialName + "-subtitle");
                        let dataResponse = await fetch("./datas/challenges/tutorial-" + tutorialName + ".json");
                        if (dataResponse && dataResponse.status === 200) {
                            let data = (await dataResponse.json());
                            let miniature = Core.Machine.MakeMiniature(this.game.machine, data.machine, { size: 256, backgroundColor: "#272b2e00" });
                            if (miniature) {
                                tutoPanel.style.background = "";
                                tutoPanel.appendChild(miniature);
                                miniature.classList.add("challenge-miniature");
                            }
                        }
                        tutoPanel.onclick = () => {
                            location.hash = "#tutorial-" + tutorialName;
                        };
                    }
                });
                this.tutorialContainer.querySelector(".prev").addEventListener("click", () => {
                    this.setTutorialScrollIndex(this.tutorialIndex - 1);
                });
                this.tutorialContainer.querySelector(".next").addEventListener("click", () => {
                    this.setTutorialScrollIndex(this.tutorialIndex + 1);
                });
                this.arcadeContainer = document.querySelector("#agility-container");
                this.arcadeCount = this.arcadeContainer.querySelectorAll(".medium-panel").length;
                this.arcadeContainer.querySelectorAll(".medium-panel").forEach(async (arcadePanel, index) => {
                    if (arcadePanel instanceof HTMLElement) {
                        let dataResponse = await fetch("./datas/challenges/parkour-" + (index + 1).toFixed(0) + ".json");
                        if (dataResponse && dataResponse.status === 200) {
                            let data = (await dataResponse.json());
                            let miniature = Core.Machine.MakeMiniature(this.game.machine, data.machine, { size: 256, backgroundColor: "#272b2e00" });
                            if (miniature) {
                                arcadePanel.style.background = "";
                                arcadePanel.appendChild(miniature);
                                miniature.classList.add("challenge-miniature");
                            }
                        }
                        arcadePanel.onclick = () => {
                            location.hash = "#parkour-" + (index + 1).toFixed(0);
                        };
                    }
                });
                this.arcadeContainer.querySelector(".prev").addEventListener("click", () => {
                    this.setArcadeScrollIndex(this.arcadeIndex - 1);
                });
                this.arcadeContainer.querySelector(".next").addEventListener("click", () => {
                    this.setArcadeScrollIndex(this.arcadeIndex + 1);
                });
                this.puzzleContainer = document.querySelector("#puzzle-container");
                this.puzzleCount = this.puzzleContainer.querySelectorAll(".medium-panel").length;
                this.puzzleContainer.querySelectorAll(".medium-panel").forEach(async (puzzlePanel, index) => {
                    if (puzzlePanel instanceof HTMLElement) {
                        let dataResponse = await fetch("./datas/challenges/puzzle-" + (index + 1).toFixed(0) + ".json");
                        if (dataResponse && dataResponse.status === 200) {
                            let data = (await dataResponse.json());
                            let miniature = Core.Machine.MakeMiniature(this.game.machine, data.machine, { size: 256, backgroundColor: "#272b2e00" });
                            if (miniature) {
                                puzzlePanel.style.background = "";
                                puzzlePanel.appendChild(miniature);
                                miniature.classList.add("challenge-miniature");
                            }
                        }
                        puzzlePanel.onclick = () => {
                            location.hash = "#puzzle-" + (index + 1).toFixed(0);
                        };
                    }
                });
                this.puzzleContainer.querySelector(".prev").addEventListener("click", () => {
                    this.setPuzzleScrollIndex(this.puzzleIndex - 1);
                });
                this.puzzleContainer.querySelector(".next").addEventListener("click", () => {
                    this.setPuzzleScrollIndex(this.puzzleIndex + 1);
                });
                this.reinitScrolls();
                resolve();
            };
        });
    }
    updateTutorialPrevNextVisibility() {
        if (this.tutorialIndex > 0) {
            this.tutorialContainer.querySelector(".prev").setAttribute("status", "");
        }
        else {
            this.tutorialContainer.querySelector(".prev").setAttribute("status", "disabled");
        }
        if (this.tutorialIndex < this.getMaxTutorialN()) {
            this.tutorialContainer.querySelector(".next").setAttribute("status", "");
        }
        else {
            this.tutorialContainer.querySelector(".next").setAttribute("status", "disabled");
        }
    }
    getMaxTutorialN() {
        let max = 5;
        if (document.body.classList.contains("vertical")) {
            max = 3;
        }
        return this.tutorialCount - max;
    }
    setTutorialScrollIndex(n) {
        let max = 5;
        if (document.body.classList.contains("vertical")) {
            max = 3;
        }
        this.tutorialIndex = Math.min(n, this.getMaxTutorialN());
        this.tutorialIndex = Math.max(this.tutorialIndex, 0);
        this.tutorialContainer.querySelectorAll(".medium-panel").forEach((icon, index) => {
            if (icon instanceof HTMLDivElement) {
                if (index < this.tutorialIndex || index >= this.tutorialIndex + max) {
                    icon.style.display = "none";
                }
                else {
                    icon.style.display = "";
                }
            }
        });
        this.updateTutorialPrevNextVisibility();
    }
    updateArcadePrevNextVisibility() {
        if (this.arcadeIndex > 0) {
            this.arcadeContainer.querySelector(".prev").setAttribute("status", "");
        }
        else {
            this.arcadeContainer.querySelector(".prev").setAttribute("status", "disabled");
        }
        if (this.arcadeIndex < this.getMaxArcadeN()) {
            this.arcadeContainer.querySelector(".next").setAttribute("status", "");
        }
        else {
            this.arcadeContainer.querySelector(".next").setAttribute("status", "disabled");
        }
    }
    getMaxArcadeN() {
        let max = 5;
        if (document.body.classList.contains("vertical")) {
            max = 3;
        }
        return this.arcadeCount - max;
    }
    setArcadeScrollIndex(n) {
        let max = 5;
        if (document.body.classList.contains("vertical")) {
            max = 3;
        }
        this.arcadeIndex = Math.min(n, this.getMaxArcadeN());
        this.arcadeIndex = Math.max(this.arcadeIndex, 0);
        this.arcadeContainer.querySelectorAll(".medium-panel").forEach((icon, index) => {
            if (icon instanceof HTMLDivElement) {
                if (index < this.arcadeIndex || index >= this.arcadeIndex + max) {
                    icon.style.display = "none";
                }
                else {
                    icon.style.display = "";
                }
            }
        });
        this.updateArcadePrevNextVisibility();
    }
    updatePuzzlePrevNextVisibility() {
        if (this.puzzleIndex > 0) {
            this.puzzleContainer.querySelector(".prev").setAttribute("status", "");
        }
        else {
            this.puzzleContainer.querySelector(".prev").setAttribute("status", "disabled");
        }
        if (this.puzzleIndex < this.getMaxPuzzleN()) {
            this.puzzleContainer.querySelector(".next").setAttribute("status", "");
        }
        else {
            this.puzzleContainer.querySelector(".next").setAttribute("status", "disabled");
        }
    }
    getMaxPuzzleN() {
        let max = 5;
        if (document.body.classList.contains("vertical")) {
            max = 3;
        }
        return this.puzzleCount - max;
    }
    setPuzzleScrollIndex(n) {
        let max = 5;
        if (document.body.classList.contains("vertical")) {
            max = 3;
        }
        this.puzzleIndex = Math.min(n, this.getMaxPuzzleN());
        this.puzzleIndex = Math.max(this.puzzleIndex, 0);
        this.puzzleContainer.querySelectorAll(".medium-panel").forEach((icon, index) => {
            if (icon instanceof HTMLDivElement) {
                if (index < this.puzzleIndex || index >= this.puzzleIndex + max) {
                    icon.style.display = "none";
                }
                else {
                    icon.style.display = "";
                }
            }
        });
        this.updatePuzzlePrevNextVisibility();
    }
    updateCompleteChallengeUI() {
        let challengeMenu = this;
        if (challengeMenu) {
            let firstNotCompletedTutorialIndex = this.getFirstNotCompletedTutorialIndex();
            let allTutoCompleted = firstNotCompletedTutorialIndex > this.tutorialCount;
            console.log("firstNotCompletedTutorialIndex " + firstNotCompletedTutorialIndex);
            let tutorialPanels = challengeMenu.tutorialContainer.querySelectorAll(".medium-panel");
            for (let index = 0; index < this.tutorialCount; index++) {
                let panel = tutorialPanels[index];
                if (panel && this.game.completedChallenges.tutorial[index] === 1) {
                    panel.setAttribute("status", "completed");
                    panel.querySelector(".stamp").src = "./datas/icons-mrs/completed.svg";
                }
                else if (panel && (index + 1) > firstNotCompletedTutorialIndex) {
                    panel.querySelector(".stamp").src = "";
                }
                else if (this.game.challenge.lastCompletedMode === ChallengeMode.Tutorial) {
                    panel.setAttribute("status", "new");
                    panel.querySelector(".stamp").src = "./datas/icons-mrs/play-stamp.svg";
                }
                else {
                    panel.setAttribute("status", "");
                    panel.querySelector(".stamp").src = "";
                }
            }
            let firstNotCompletedParkourIndex = this.getFirstNotCompletedParkourIndex();
            let parkourPanels = challengeMenu.arcadeContainer.querySelectorAll(".medium-panel");
            for (let index = 0; index < this.arcadeCount; index++) {
                let panel = parkourPanels[index];
                let prev = parkourPanels[index - 1];
                if (panel && this.game.completedChallenges.parkour[index] === 1) {
                    panel.setAttribute("status", "completed");
                    panel.querySelector(".stamp").src = "./datas/icons-mrs/completed.svg";
                    let connector = panel.querySelector(".connector");
                    if (connector) {
                        connector.classList.remove("to-lock");
                    }
                }
                else if (panel && (index + 1) > firstNotCompletedParkourIndex) {
                    panel.setAttribute("status", "locked");
                    panel.querySelector(".stamp").src = "./datas/icons/locked.svg";
                    let connector = panel.querySelector(".connector");
                    if (connector) {
                        if (prev && (prev.getAttribute("status") != "locked")) {
                            connector.classList.add("to-lock");
                        }
                        else {
                            connector.classList.remove("to-lock");
                        }
                    }
                }
                else {
                    if (this.game.challenge.lastCompletedMode === ChallengeMode.Parkour || allTutoCompleted) {
                        panel.setAttribute("status", "new");
                        panel.querySelector(".stamp").src = "./datas/icons-mrs/play-stamp.svg";
                    }
                    else {
                        panel.setAttribute("status", "");
                        panel.querySelector(".stamp").src = "";
                    }
                    let connector = panel.querySelector(".connector");
                    if (connector) {
                        connector.classList.remove("to-lock");
                    }
                }
            }
            let firstNotCompletedPuzzleIndex = this.getFirstNotCompletedPuzzleIndex();
            let puzzlePanels = challengeMenu.puzzleContainer.querySelectorAll(".medium-panel");
            for (let index = 0; index < this.puzzleCount; index++) {
                let panel = puzzlePanels[index];
                let prev = puzzlePanels[index - 1];
                if (panel && this.game.completedChallenges.puzzle[index] === 1) {
                    panel.setAttribute("status", "completed");
                    panel.querySelector(".stamp").src = "./datas/icons-mrs/completed.svg";
                    let connector = panel.querySelector(".connector");
                    if (connector) {
                        connector.classList.remove("to-lock");
                    }
                }
                else if (panel && (index + 1) > firstNotCompletedPuzzleIndex) {
                    panel.setAttribute("status", "locked");
                    panel.querySelector(".stamp").src = "./datas/icons/locked.svg";
                    let connector = panel.querySelector(".connector");
                    if (connector) {
                        if (prev && (prev.getAttribute("status") != "locked")) {
                            connector.classList.add("to-lock");
                        }
                        else {
                            connector.classList.remove("to-lock");
                        }
                    }
                }
                else {
                    if (this.game.challenge.lastCompletedMode === ChallengeMode.Puzzle || allTutoCompleted) {
                        panel.setAttribute("status", "new");
                        panel.querySelector(".stamp").src = "./datas/icons-mrs/play-stamp.svg";
                    }
                    else {
                        panel.setAttribute("status", "");
                    }
                    let connector = panel.querySelector(".connector");
                    if (connector) {
                        connector.classList.remove("to-lock");
                    }
                }
            }
        }
        /*
        let completionPercent = 0;
        for (let i = 0; i < this.tutorialCount; i++) {
            if (this.game.completedChallenges.tutorial[i] === 1) {
                completionPercent += 1 / this.tutorialCount * 100;
            }
        }
        document.querySelector("#tuto-completion-percent").innerHTML = completionPercent.toFixed(0);

        if (Math.round(completionPercent) === 100) {
            document.querySelector("#puzzle-goto-button").classList.add("hint");
        }
        */
    }
    initializeChallengeMenuPageProgress() {
        this.game.completedChallenges = {
            version: CHALLENGE_VERSION,
            tutorial: [],
            parkour: [],
            puzzle: []
        };
        if (HasLocalStorage) {
            let completedChallengesString = window.localStorage.getItem("completed-challenges");
            if (completedChallengesString) {
                let completedChallengesFromLocalStorage = JSON.parse(completedChallengesString);
                if (completedChallengesFromLocalStorage) {
                    if (completedChallengesFromLocalStorage.version === CHALLENGE_VERSION) {
                        if (completedChallengesFromLocalStorage.tutorial) {
                            this.game.completedChallenges.tutorial = completedChallengesFromLocalStorage.tutorial;
                        }
                        if (completedChallengesFromLocalStorage.parkour) {
                            this.game.completedChallenges.parkour = completedChallengesFromLocalStorage.parkour;
                        }
                        if (completedChallengesFromLocalStorage.puzzle) {
                            this.game.completedChallenges.puzzle = completedChallengesFromLocalStorage.puzzle;
                        }
                    }
                }
            }
        }
        this.updateCompleteChallengeUI();
    }
    getFirstNotCompletedTutorialIndex() {
        for (let i = 0; i < this.tutorialCount; i++) {
            if (this.game.completedChallenges.tutorial[i] != 1) {
                return i + 1;
            }
        }
        return this.tutorialCount + 1;
    }
    getFirstNotCompletedParkourIndex() {
        for (let i = 0; i < this.arcadeCount; i++) {
            if (this.game.completedChallenges.parkour[i] != 1) {
                return i + 1;
            }
        }
        return this.arcadeCount + 1;
    }
    getFirstNotCompletedPuzzleIndex() {
        for (let i = 0; i < this.puzzleCount; i++) {
            if (this.game.completedChallenges.puzzle[i] != 1) {
                return i + 1;
            }
        }
        return this.puzzleCount + 1;
    }
    reinitScrolls() {
        let offset = 3;
        if (document.body.classList.contains("vertical")) {
            offset = 2;
        }
        this.setTutorialScrollIndex(this.getFirstNotCompletedTutorialIndex() - offset);
        this.setArcadeScrollIndex(this.getFirstNotCompletedParkourIndex() - offset);
        this.setPuzzleScrollIndex(this.getFirstNotCompletedPuzzleIndex() - offset);
    }
}
var I18NTextLangs;
(function (I18NTextLangs) {
    I18NTextLangs[I18NTextLangs["English"] = 0] = "English";
    I18NTextLangs[I18NTextLangs["French"] = 1] = "French";
    I18NTextLangs[I18NTextLangs["MAXIMUM"] = 2] = "MAXIMUM";
})(I18NTextLangs || (I18NTextLangs = {}));
var I18NTextLangNames = ["中文", "français", "português"];
var I18NTextLangFileNames = ["english", "french", "portuguese"];
var I18NTextLangAttr = ["en", "fr", "pt"];
class I18NText extends HTMLElement {
    constructor() {
        super(...arguments);
        this._attemps = 0;
    }
    static async WaitFor(lang) {
        return new Promise((resolve) => {
            let check = () => {
                if (I18NText.LoadedLangs.get(lang)) {
                    resolve();
                }
                else {
                    requestAnimationFrame(check);
                }
            };
            check();
        });
    }
    static async GetMapForLang(lang) {
        if (!I18NText.LangFilePath) {
            return undefined;
        }
        let map = I18NText.LoadedLangs.get(lang);
        if (!map) {
            if (!I18NText.Loading.contains(lang)) {
                //let url = I18NText.LangFilesDir + "/" + I18NTextLangFileNames[lang] + ".json";
                let url = I18NText.LangFilePath;
                if (url) {
                    I18NText.Loading.push(lang);
                    let dataResponse = await fetch(url);
                    if (dataResponse) {
                        let content = await dataResponse.text();
                        map = {};
                        let lines = content.split("\n");
                        for (let i = 0; i < lines.length; i++) {
                            if (lines[i]) {
                                let cells = lines[i].split(";");
                                let key = cells[0];
                                if (key) {
                                    let text = cells[lang + 1];
                                    if (text) {
                                        map[key] = text;
                                    }
                                }
                            }
                        }
                    }
                    I18NText.LoadedLangs.set(lang, map);
                    I18NText.Loading.remove(lang);
                }
            }
            else {
                await I18NText.WaitFor(lang);
                map = I18NText.LoadedLangs.get(lang);
            }
        }
        return map;
    }
    static async GetTextForLang(lang, textKey) {
        let map = await this.GetMapForLang(lang);
        if (map) {
            let text = map[textKey];
            if (text) {
                return text;
            }
        }
        let fallbackMap = await this.GetMapForLang(I18NText.FallbackLang);
        if (fallbackMap) {
            let fallbackText = fallbackMap[textKey];
            if (fallbackText) {
                return fallbackText;
            }
        }
        return undefined;
    }
    static async SetCurrentLang(lang) {
        I18NText.CurrentLang = lang;
        let allTexts = document.querySelectorAll("i18n-text");
        await I18NText.GetMapForLang(lang);
        allTexts.forEach((text) => {
            if (text instanceof I18NText) {
                text.setAttribute("i18n-lang", I18NTextLangAttr[lang]);
            }
        });
    }
    static get observedAttributes() {
        return ["i18n-lang", "text-key"];
    }
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "i18n-lang") {
            let prevLang = this._lang;
            if (newValue === "en") {
                this._lang = I18NTextLangs.English;
            }
            else if (newValue === "fr") {
                this._lang = I18NTextLangs.French;
            } /*else if (newValue === "pt") {
                this._lang = I18NTextLangs.Portuguese;
            }*/
            if (this._lang != prevLang) {
                this.updateContent();
            }
        }
        else if (name === "text-key") {
            if (newValue != this._textKey) {
                this._textKey = newValue;
                this.updateContent();
            }
        }
    }
    connectedCallback() {
        if (!this.hasAttribute("i18n-lang")) {
            this.setAttribute("i18n-lang", I18NTextLangAttr[I18NText.CurrentLang]);
        }
    }
    async updateContent() {
        if (this._textKey && this._lang >= 0) {
            clearTimeout(this._retryTimeout);
            let text = await I18NText.GetTextForLang(this._lang, this._textKey);
            if (text === undefined) {
                this.innerHTML = "無文字";
                this._attemps++;
                this._retryTimeout = setTimeout(() => {
                    this.updateContent();
                }, this._attemps * 1000);
            }
            else {
                this.innerHTML = text;
                this._attemps = 0;
            }
        }
    }
}
I18NText.Loading = new Nabu.UniqueList();
I18NText.FallbackLang = I18NTextLangs.English;
I18NText.CurrentLang = I18NTextLangs.English;
I18NText.LoadedLangs = new Map();
/*
I18NText.LoadedLangs.set(I18NTextLangs.English, {
    
});
*/
customElements.define("i18n-text", I18NText);
class MarbleRouter extends Nabu.Router {
    constructor(game) {
        super();
        this.game = game;
        this.showOptionsPage = () => {
            if (!this.optionsPage.shown) {
                let lastPlayState = PokiSDKPlaying;
                if (USE_POKI_SDK) {
                    PokiGameplayStop();
                }
                this.show(this.optionsPage, true, 0);
                this.optionsPage.backButton.onclick = () => {
                    if (USE_POKI_SDK) {
                        if (lastPlayState) {
                            PokiGameplayStart();
                        }
                    }
                    this.optionsPage.hide(0);
                };
            }
        };
    }
    onFindAllPages() {
        this.homeMenu = new HomeMenu(this.game);
        this.homeMenu.initialize();
        this.communityMenu = new CommunityMenu(this.game);
        this.communityMenu.initialize();
        this.bbPuzzlesMenu = new BBPuzzlesMenu(this.game);
        this.bbPuzzlesMenu.initialize();
        this.creditsPage = document.getElementById("credits-page");
        this.devModePage = document.getElementById("dev-mode-page");
        this.userMachines = new UserMachinesPage(this.game);
        this.optionsPage = document.getElementById("option-page");
        this.homeButton = document.getElementById("home-button");
        this.optionButton = document.getElementById("option-button");
        this.optionButton.onclick = this.showOptionsPage;
        this.pages.push(this.game.challenge.tutoPopup);
        this.pages.push(this.game.challenge.tutoComplete);
        this.pages.push(this.game.shareMenuView);
        this.pages.push(this.game.exportMenuView);
        this.pages.push(this.game.constructionModeMenuView);
    }
    onUpdate() { }
    async onHRefChange(page, previousPage) {
        console.log("onHRefChange previous " + previousPage + " now " + page);
        this.homeButton.style.display = "none";
        this.optionButton.style.display = "none";
        document.getElementById("challenge-topbar").style.display = "none";
        if (this.game.challenge) {
            this.game.challenge.helper.hide();
        }
        if (this.game.machineEditor) {
            this.game.machineEditor.dispose();
        }
        this.game.bbPuzzle.dispose();
        this.game.challenge.skipButton.hide();
        this.game.musicDisplay.hide();
        this.game.photoMaker.deactivate();
        if (this.game.toolbar) {
            this.game.toolbar.playButton.classList.remove("inactive");
            this.game.toolbar.stopButton.classList.remove("inactive");
        }
        let isChallenge = false;
        let challengeRadix = "";
        if (page.startsWith("#tutorial-")) {
            challengeRadix = "tutorial";
            isChallenge = true;
        }
        else if (page.startsWith("#parkour-")) {
            challengeRadix = "parkour";
            isChallenge = true;
        }
        else if (page.startsWith("#puzzle-")) {
            challengeRadix = "puzzle";
            isChallenge = true;
        }
        let isBBPuzzle = false;
        if (page.startsWith("#bb-puzzle-")) {
            isBBPuzzle = true;
        }
        if (BB_PUZZLE_ONLY) {
            if (!isBBPuzzle && page != "#bb-puzzles") {
                page = "#bb-puzzle-1";
                isBBPuzzle = true;
            }
        }
        if (page.startsWith("#options")) {
            if (!this.game.machine.instantiated) {
                await this.game.machine.generateBaseMesh();
                this.game.setCameraMode(CameraMode.Landscape);
                this.game.machine.instantiate().then(() => {
                    this.game.machine.play();
                    this.game.updateMachineAuthorAndName();
                    document.getElementById("click-anywhere-screen").style.display = "none";
                });
            }
            document.getElementById("click-anywhere-screen").style.display = "none";
            this.game.mode = GameMode.Page;
            this.show(this.optionsPage, false, 0);
            this.optionsPage.backButton.onclick = () => { location.hash = "#home"; };
            if (USE_POKI_SDK) {
                PokiGameplayStop();
            }
        }
        else if (page.startsWith("#credits")) {
            if (!this.game.machine.instantiated) {
                await this.game.machine.generateBaseMesh();
                this.game.setCameraMode(CameraMode.Landscape);
                this.game.machine.instantiate().then(() => {
                    this.game.machine.play();
                    this.game.updateMachineAuthorAndName();
                    document.getElementById("click-anywhere-screen").style.display = "none";
                });
            }
            document.getElementById("click-anywhere-screen").style.display = "none";
            this.game.mode = GameMode.Page;
            this.game.setCameraMode(this.game.menuCameraMode);
            this.show(this.creditsPage, false, 0);
            if (USE_POKI_SDK) {
                PokiGameplayStop();
            }
        }
        else if (page.startsWith("#dev-mode")) {
            if (!this.game.machine.instantiated) {
                await this.game.machine.generateBaseMesh();
                await this.game.machine.instantiate();
            }
            this.show(this.devModePage, false, 0);
        }
        else if (page.startsWith("#user-machines")) {
            if (!location.host.startsWith("127.0.0.1")) {
                location.hash = "#home";
                return;
            }
            if (!this.game.machine.instantiated) {
                await this.game.machine.generateBaseMesh();
                await this.game.machine.instantiate();
            }
            document.getElementById("click-anywhere-screen").style.display = "none";
            this.game.machine.play();
            this.game.mode = GameMode.Page;
            this.game.setCameraMode(this.game.menuCameraMode);
            this.userMachines.redraw();
            this.show(this.userMachines.page, false, 0);
            if (USE_POKI_SDK) {
                PokiGameplayStop();
            }
        }
        else if (page.startsWith("#community")) {
            if (!this.game.machine.instantiated) {
                await this.game.machine.generateBaseMesh();
                this.game.setCameraMode(CameraMode.Landscape);
                this.game.machine.instantiate().then(() => {
                    this.game.machine.play();
                    this.game.updateMachineAuthorAndName();
                    document.getElementById("click-anywhere-screen").style.display = "none";
                });
            }
            this.game.mode = GameMode.Page;
            this.game.setCameraMode(this.game.menuCameraMode);
            let pageNum;
            if (page.indexOf("?page=") != -1) {
                pageNum = parseInt(page.split("?page=")[1]);
            }
            this.show(this.communityMenu.page, false, 0);
            this.communityMenu.redraw(pageNum);
            document.getElementById("click-anywhere-screen").style.display = "none";
            if (USE_POKI_SDK) {
                PokiGameplayStop();
            }
        }
        else if (page.startsWith("#bb-puzzles")) {
            if (!this.game.machine.instantiated) {
                await this.game.machine.generateBaseMesh();
                this.game.setCameraMode(CameraMode.Landscape);
                this.game.machine.instantiate().then(() => {
                    this.game.machine.play();
                    this.game.updateMachineAuthorAndName();
                    document.getElementById("click-anywhere-screen").style.display = "none";
                });
            }
            this.game.mode = GameMode.Page;
            this.game.setCameraMode(this.game.menuCameraMode);
            let pageNum;
            if (page.indexOf("?page=") != -1) {
                pageNum = parseInt(page.split("?page=")[1]);
            }
            this.show(this.bbPuzzlesMenu.page, false, 0);
            this.bbPuzzlesMenu.redraw(pageNum);
            document.getElementById("click-anywhere-screen").style.display = "none";
            if (USE_POKI_SDK) {
                PokiGameplayStop();
            }
        }
        else if (page.startsWith("#editor")) {
            if (previousPage && previousPage.startsWith("#home") && (!this.game.machine.hasBeenOpenedInEditor || this.game.machine.constructionMode != this.game.constructionModeMenuView.selectedMode)) {
                this.game.machine.dispose();
                if (this.game.constructionModeMenuView.selectedMode === Core.MachineConstructionMode.Mode2D) {
                    this.game.machine.deserialize(RandomDefault2DTrack());
                    this.game.machine.setRoomIndex(RandomMachineEditorRoomIndex());
                }
                else if (this.game.constructionModeMenuView.selectedMode === Core.MachineConstructionMode.Mode3D) {
                    this.game.machine.deserialize(RandomDefault3DTrack());
                    this.game.machine.setRoomIndex(RandomMachineEditorRoomIndex());
                }
                else {
                    this.game.machine.deserialize(RandomDefault3DTrack());
                    this.game.machine.setRoomIndex(RandomMachineEditorRoomIndex());
                }
                this.game.machine.toonOutlineRender = Math.random() < 0.5 ? true : false;
                let randomColor = Math.floor(Math.random() * MachineEditorPartColors.length);
                colorizeEntireMachine(this.game.machine, randomColor);
                this.game.machineEditor.lastSelectedColors[0] = randomColor;
            }
            if (!this.game.DEBUG_MODE && this.game.machine.isChallengeMachine) {
                this.game.machine.dispose();
                if (this.game.constructionModeMenuView.selectedMode === Core.MachineConstructionMode.Mode2D) {
                    this.game.machine.deserialize(RandomDefault2DTrack());
                }
                else if (this.game.constructionModeMenuView.selectedMode === Core.MachineConstructionMode.Mode3D) {
                    this.game.machine.deserialize(RandomDefault3DTrack());
                }
                else {
                    this.game.machine.deserialize(RandomDefault3DTrack());
                }
                this.game.machine.toonOutlineRender = Math.random() < 0.5 ? true : false;
                let randomColor = Math.floor(Math.random() * MachineEditorPartColors.length);
                colorizeEntireMachine(this.game.machine, randomColor);
                this.game.machineEditor.lastSelectedColors[0] = randomColor;
            }
            if (!this.game.machine.instantiated) {
                await this.game.machine.generateBaseMesh();
                await this.game.machine.instantiate();
            }
            this.game.machine.hasBeenOpenedInEditor = true;
            this.game.mode = GameMode.Create;
            this.game.setCameraMode(CameraMode.None).then(() => {
                this.game.focusMachineParts(true, false, ...this.game.machine.parts);
            });
            this.game.machine.stop();
            this.game.machine.setAllIsSelectable(true);
            if (USE_POKI_SDK) {
                PokiGameplayStop();
                await PokiCommercialBreak();
            }
            this.hideAll(0);
            this.homeButton.style.display = "";
            this.optionButton.style.display = "";
            this.game.machineEditor.allowEditMachinePart = true;
            this.game.machineEditor.allowAutoMirrorXOnDrag = true;
            if (USE_POKI_SDK) {
                PokiGameplayStart();
            }
            await this.game.machineEditor.instantiate();
            this.game.topbar.resize();
        }
        else if (page.startsWith("#demo-")) {
            let index = page.replace("#demo-", "");
            this.game.mode = GameMode.Demo;
            this.game.setCameraMode(CameraMode.Landscape);
            await this.hideAll(0);
            this.homeButton.style.display = "";
            this.optionButton.style.display = "";
            let dataResponse = await fetch("./datas/demos/" + index + ".json");
            if (dataResponse) {
                let data = await dataResponse.json();
                if (data) {
                    let needReload = true;
                    if (Core.Machine.MachineDataCompare(this.game.machine.lastDeserializedData, data)) {
                        needReload = false;
                    }
                    if (needReload) {
                        this.game.machine.dispose();
                        this.game.machine.deserialize(data);
                        if (USE_POKI_SDK) {
                            PokiGameplayStop();
                            await PokiCommercialBreak();
                        }
                        await this.game.machine.generateBaseMesh();
                        this.game.machine.instantiate().then(() => {
                            this.game.updateMachineAuthorAndName();
                            this.game.machine.play();
                        });
                    }
                    else {
                        this.game.machine.play();
                    }
                    this.game.setCameraMode(CameraMode.Landscape);
                    if (USE_POKI_SDK) {
                        PokiGameplayStart();
                    }
                }
            }
        }
        else if (isBBPuzzle) {
            this.game.mode = GameMode.BBPuzzle;
            let index;
            let isBonusLevel = page.indexOf("#bb-puzzle-bonus-") != -1;
            if (isBonusLevel) {
                index = parseInt(page.replace("#bb-puzzle-bonus-", ""));
                if (!isFinite(index) || index >= BB_PUZZLES_BONUS_LEVELS.length) {
                    location.hash = "#bb-puzzles";
                    return;
                }
            }
            else {
                index = parseInt(page.replace("#bb-puzzle-", ""));
                if (!isFinite(index)) {
                    index = 1;
                }
                else if (index < 1000 && index >= BB_PUZZLES_LEVELS.length) {
                    index = 1;
                }
                else if (index > 1000 && index - 1000 >= BB_PUZZLES_LEVELS.length) {
                    index = 1001;
                }
            }
            let data = await this.game.bbPuzzleLoader.getPuzzle(IndexToBBPuzzleLevel(index, isBonusLevel), this.game.devMode.activated || this.game.DEBUG_MODE || true);
            if (data) {
                //console.error("bb-puzzle #" + index.toFixed(0) + " " + IndexToBBPuzzleLevel(index, isBonusLevel));
                this.hideAll(0);
                this.homeButton.style.display = "none";
                this.optionButton.style.display = "none";
                this.game.machine.stop();
                this.game.machine.dispose();
                this.game.machine.deserialize(data.machine);
                this.game.machine.setRoomIndex(13);
                if (USE_POKI_SDK) {
                    PokiGameplayStop();
                    await PokiCommercialBreak();
                }
                await this.game.machine.instantiate();
                await this.game.machine.generateBaseMesh();
                await WaitPlayerInteraction();
                this.game.bbPuzzle.index = index;
                this.game.bbPuzzle.isBonusLevel = isBonusLevel;
                this.game.bbPuzzle.initialize(data);
                //await this.game.machineEditor.instantiate();
                this.game.setCameraMode(CameraMode.None).then(() => {
                    this.game.focusMachineParts(true, false, ...this.game.machine.parts);
                });
                if (USE_POKI_SDK) {
                    PokiGameplayStart();
                }
            }
        }
        else if (isChallenge) {
            let dataResponse;
            this.game.mode = GameMode.Challenge;
            let index;
            if (challengeRadix === "tutorial") {
                index = page.replace("#" + challengeRadix + "-", "");
                dataResponse = await fetch("./datas/challenges/" + challengeRadix + "-" + index + ".json");
            }
            else {
                index = parseInt(page.replace("#" + challengeRadix + "-", ""));
                dataResponse = await fetch("./datas/challenges/" + challengeRadix + "-" + index.toFixed() + ".json");
            }
            if (dataResponse && dataResponse.status === 404) {
                location.hash = "#home";
                return;
            }
            if (dataResponse && dataResponse.status === 200) {
                let data = (await dataResponse.json());
                if (data) {
                    if (data.mode === ChallengeMode.Parkour) {
                        this.game.setCameraMode(CameraMode.Landscape);
                    }
                    this.hideAll(0);
                    this.homeButton.style.display = "";
                    this.optionButton.style.display = "";
                    data.index = index;
                    this.game.machine.stop();
                    this.game.machine.dispose();
                    this.game.machine.deserialize(data.machine);
                    this.game.machine.isChallengeMachine = true;
                    if (USE_POKI_SDK) {
                        PokiGameplayStop();
                        await PokiCommercialBreak();
                    }
                    await this.game.machine.instantiate();
                    await this.game.machine.generateBaseMesh();
                    if (data.mode === ChallengeMode.Parkour) {
                        this.game.setCameraMode(CameraMode.Landscape);
                    }
                    this.game.machine.setAllIsSelectable(false);
                    await WaitPlayerInteraction();
                    this.game.challenge.mode = isFinite(data.mode) ? data.mode : ChallengeMode.Tutorial;
                    this.game.challenge.availableElements = data.elements;
                    this.game.challenge.initialize(data);
                    if (this.game.challenge.mode === ChallengeMode.Tutorial || this.game.challenge.mode === ChallengeMode.Puzzle) {
                        this.game.machineEditor.allowEditMachinePart = data.allowEditMachinePart;
                        this.game.machineEditor.allowAutoMirrorXOnDrag = data.allowAutoMirrorXOnDrag;
                        await this.game.machineEditor.instantiate();
                        this.game.setCameraMode(CameraMode.None).then(() => {
                            this.game.focusMachineParts(true, index === "lift", ...this.game.machine.parts);
                        });
                    }
                    if (USE_POKI_SDK) {
                        PokiGameplayStart();
                    }
                }
            }
        }
        else if (page.startsWith("#home")) {
            if (this.game.machine.parts.length === 0) {
                this.game.machine.dispose();
                this.game.machine.deserialize(RandomDefault3DTrack());
                let randomColor = Math.floor(Math.random() * MachineEditorPartColors.length);
                colorizeEntireMachine(this.game.machine, randomColor);
                this.game.machineEditor.lastSelectedColors[0] = randomColor;
            }
            if (!this.game.machine.instantiated) {
                await this.game.machine.generateBaseMesh();
                this.game.setCameraMode(CameraMode.Landscape);
                this.game.machine.instantiate().then(() => {
                    this.game.machine.play();
                    this.game.updateMachineAuthorAndName();
                    document.getElementById("click-anywhere-screen").style.display = "none";
                });
            }
            else {
                this.game.setCameraMode(CameraMode.Landscape);
                this.game.machine.play();
                this.game.updateMachineAuthorAndName();
                document.getElementById("click-anywhere-screen").style.display = "none";
            }
            this.homeMenu.reinitScrolls();
            await this.show(this.homeMenu.page, false, 0);
            requestAnimationFrame(() => {
                this.homeMenu.updateCompleteChallengeUI();
            });
            this.game.mode = GameMode.Home;
            if (USE_POKI_SDK) {
                PokiGameplayStop();
            }
        }
        else if (page.startsWith("#machine")) {
            let id = parseInt(page.replace("#machine?id=", ""));
            if (isFinite(id)) {
                this.game.mode = GameMode.Demo;
                this.game.setCameraMode(CameraMode.Landscape);
                this.hideAll(0);
                this.homeButton.style.display = "";
                this.optionButton.style.display = "";
                let request = "machine";
                if (id > 10000) {
                    request = "machine_old";
                }
                if (this.game.OFFLINE_MODE) {
                    let data = await this.game.offlineDatabase.offlineGet(id);
                    if (data) {
                        this.game.machine.dispose();
                        this.game.machine.deserialize(data);
                        if (USE_POKI_SDK) {
                            PokiGameplayStop();
                            await PokiCommercialBreak();
                        }
                        this.game.setCameraMode(CameraMode.Landscape).then(() => {
                            this.game.focusMachineParts(true, false, ...this.game.machine.parts);
                        });
                        this.game.machine.generateBaseMesh();
                        this.game.machine.instantiate().then(() => {
                            this.game.updateMachineAuthorAndName();
                            this.game.machine.play();
                            this.game.setCameraMode(CameraMode.Landscape);
                            document.getElementById("click-anywhere-screen").style.display = "none";
                        });
                        if (USE_POKI_SDK) {
                            PokiGameplayStart();
                        }
                    }
                }
                else {
                    let headers = undefined;
                    if (this.game.devMode.activated) {
                        headers = {
                            "Authorization": 'Basic ' + btoa("carillon:" + this.game.devMode.getPassword())
                        };
                    }
                    let dataResponse = await fetch(SHARE_SERVICE_PATH + request + "/" + id.toFixed(0), {
                        method: "GET",
                        mode: "cors",
                        headers: headers
                    });
                    if (dataResponse) {
                        try {
                            let data = await dataResponse.json();
                            if (data) {
                                this.game.machine.dispose();
                                this.game.machine.deserialize(data);
                                if (USE_POKI_SDK) {
                                    PokiGameplayStop();
                                    await PokiCommercialBreak();
                                }
                                this.game.machine.generateBaseMesh();
                                this.game.setCameraMode(CameraMode.Landscape);
                                this.game.machine.instantiate().then(() => {
                                    this.game.updateMachineAuthorAndName();
                                    this.game.machine.play();
                                    this.game.setCameraMode(CameraMode.Landscape);
                                    document.getElementById("click-anywhere-screen").style.display = "none";
                                });
                                if (USE_POKI_SDK) {
                                    PokiGameplayStart();
                                }
                            }
                        }
                        catch (error) {
                            console.error("Failed to load from machineId. Falling back to a Default machine.");
                            this.game.machine.dispose();
                            this.game.machine.deserialize(RandomDefault3DTrack());
                            this.game.machine.generateBaseMesh();
                            this.game.machine.instantiate().then(() => {
                                this.game.updateMachineAuthorAndName();
                                this.game.machine.play();
                                this.game.setCameraMode(CameraMode.Landscape);
                                document.getElementById("click-anywhere-screen").style.display = "none";
                            });
                            if (USE_POKI_SDK) {
                                PokiGameplayStart();
                            }
                        }
                    }
                }
            }
            else {
                location.hash = "#home";
                return;
            }
        }
        else {
            location.hash = "#home";
            return;
        }
        if (this.game.toolbar) {
            this.game.toolbar.closeAllDropdowns();
            this.game.toolbar.resize();
        }
        if (this.game.topbar) {
            this.game.topbar.resize();
        }
        this.game.machine.regenerateBaseAxis();
        this.game.updateMachineAuthorAndName();
        if (this.game.machineEditor) {
            this.game.machineEditor.machinePartEditorMenu.update();
        }
    }
}
class MaterialPicker extends HTMLElement {
    constructor() {
        super(...arguments);
        this.targetIndex = -1;
        this.buttons = [];
        this.selectInput = null;
        this._loaded = false;
        this._shown = false;
        this.onColorIndexChanged = (colorIndex) => { };
    }
    static get observedAttributes() {
        return [];
    }
    get loaded() {
        return this._loaded;
    }
    get shown() {
        return this._shown;
    }
    get onLoad() {
        return this._onLoad;
    }
    set onLoad(callback) {
        this._onLoad = callback;
        if (this._loaded) {
            this._onLoad();
        }
    }
    async waitLoaded() {
        return new Promise(resolve => {
            let wait = () => {
                if (this._loaded) {
                    resolve();
                }
                else {
                    requestAnimationFrame(wait);
                }
            };
            wait();
        });
    }
    connectedCallback() {
        this.style.display = "none";
        this.addEventListener("pointerdown", StopPointerProgatation);
        this.addEventListener("pointermove", StopPointerProgatation);
        this.addEventListener("pointerup", StopPointerProgatationAndMonkeys);
        this.container = document.createElement("div");
        this.container.classList.add("container");
        this.appendChild(this.container);
        this._metalTitle = document.createElement("h2");
        this._metalTitle.innerHTML = "金屬";
        this.container.appendChild(this._metalTitle);
        this.metalMaterialButtons = document.createElement("div");
        this.metalMaterialButtons.classList.add("square-material-buttons-container");
        this.container.appendChild(this.metalMaterialButtons);
        this._plasticTitle = document.createElement("h2");
        this._plasticTitle.innerHTML = "塑膠";
        this.container.appendChild(this._plasticTitle);
        this.plasticMaterialButtons = document.createElement("div");
        this.plasticMaterialButtons.classList.add("square-material-buttons-container");
        this.container.appendChild(this.plasticMaterialButtons);
        this._loaded = true;
    }
    initPartMaterialButtons(game) {
        this.buttons = [];
        for (let i = 0; i < MachineEditorPartColors.length; i++) {
            let editorColor = MachineEditorPartColors[i];
            let matButton = document.createElement("button");
            if (location.host.startsWith("127.0.0.1")) {
                matButton.setAttribute("title", editorColor.colorName + " " + editorColor.index);
            }
            else {
                matButton.setAttribute("title", editorColor.colorName);
            }
            let material = game.materials.getMaterial(editorColor.index, game.getGraphicQ());
            if (material instanceof BABYLON.StandardMaterial) {
                matButton.style.backgroundColor = material.diffuseColor.toHexString();
            }
            if (material instanceof BABYLON.PBRMetallicRoughnessMaterial) {
                matButton.style.backgroundColor = material.baseColor.toHexString();
            }
            let materialType = game.materials.getMaterialType(editorColor.index);
            if (materialType === Core.MaterialType.Metal) {
                this.metalMaterialButtons.appendChild(matButton);
            }
            else if (materialType === Core.MaterialType.Plastic) {
                this.plasticMaterialButtons.appendChild(matButton);
            }
            this.buttons[editorColor.index] = matButton;
            matButton.onclick = () => {
                this.setCurrentColorIndex(editorColor.index);
                if (this.onColorIndexChanged) {
                    this.onColorIndexChanged(editorColor.index);
                }
            };
        }
    }
    initBallMaterialButtons(game) {
        this._plasticTitle.innerHTML = "標誌";
        this.buttons = [];
        for (let i = 0; i < MachineEditorBallColors.length; i++) {
            let editorColor = MachineEditorBallColors[i];
            let matButton = document.createElement("button");
            if (location.host.startsWith("127.0.0.1")) {
                matButton.setAttribute("title", editorColor.colorName + " " + editorColor.index);
            }
            else {
                matButton.setAttribute("title", editorColor.colorName);
            }
            let material = game.materials.getBallMaterial(editorColor.index, game.getGraphicQ());
            if (material instanceof BABYLON.StandardMaterial) {
                matButton.style.backgroundColor = material.diffuseColor.toHexString();
            }
            if (material instanceof BABYLON.PBRMetallicRoughnessMaterial) {
                matButton.style.backgroundColor = material.baseColor.toHexString();
            }
            let materialType = game.materials.getBallMaterialType(editorColor.index);
            if (materialType === Core.BallMaterialType.Metal) {
                this.metalMaterialButtons.appendChild(matButton);
            }
            else if (materialType === Core.BallMaterialType.Logo) {
                this.plasticMaterialButtons.appendChild(matButton);
                let url;
                if (material instanceof BABYLON.StandardMaterial) {
                    url = material.diffuseTexture._texture.url;
                }
                if (material instanceof BABYLON.PBRMetallicRoughnessMaterial) {
                    url = material.baseTexture._texture.url;
                }
                if (url) {
                    matButton.style.backgroundImage = "url(" + url + ")";
                    matButton.style.backgroundSize = "150%";
                    matButton.style.backgroundPosition = "center";
                }
            }
            this.buttons[editorColor.index] = matButton;
            matButton.onclick = () => {
                this.setCurrentColorIndex(editorColor.index);
                if (this.onColorIndexChanged) {
                    this.onColorIndexChanged(editorColor.index);
                }
            };
        }
        let countryTitle = document.createElement("h2");
        countryTitle.innerHTML = "國旗";
        this.container.appendChild(countryTitle);
        this.selectInput = document.createElement("select");
        this.selectInput.innerHTML = `
            <button>
                <selectedcontent></selectedcontent>
            </button>
        `;
        for (let i = 0; i < ExistingCountryFlags.length; i++) {
            let opt = document.createElement("option");
            opt.value = ExistingCountryFlags[i].code;
            let icon = document.createElement("span");
            icon.classList.add("fi", "fi-" + ExistingCountryFlags[i].code);
            icon.style.marginRight = "5px";
            opt.appendChild(icon);
            let countryName = document.createElement("span");
            countryName.innerHTML = ExistingCountryFlags[i].name;
            opt.appendChild(countryName);
            this.selectInput.appendChild(opt);
        }
        this.selectInput.oninput = () => {
            let code = this.selectInput.value;
            let index = ExistingCountryFlags.findIndex(c => c.code === code);
            if (index >= 0) {
                this.setCurrentColorIndex(25 + index);
                if (this.onColorIndexChanged) {
                    this.onColorIndexChanged(25 + index);
                }
            }
        };
        this.container.appendChild(this.selectInput);
    }
    setCurrentColorIndex(colorIndex) {
        this.buttons.forEach(btn => {
            btn.classList.remove("selected");
        });
        if (this.buttons[colorIndex]) {
            this.buttons[colorIndex].classList.add("selected");
        }
        if (this.selectInput) {
            this.selectInput.classList.remove("selected");
            if (colorIndex < 25) {
                this.selectInput.value = "";
            }
            else {
                let countryFlagIndex = colorIndex - 25;
                if (countryFlagIndex >= 0 && countryFlagIndex < ExistingCountryFlags.length) {
                    this.selectInput.value = ExistingCountryFlags[countryFlagIndex].code;
                    this.selectInput.classList.add("selected");
                }
            }
        }
    }
    attributeChangedCallback(name, oldValue, newValue) { }
    setAnchor(x, y) {
        let w = window.innerWidth;
        let h = window.innerHeight;
        if (document.body.classList.contains("vertical")) {
            this.style.right = x.toFixed(0) + "px";
            this.style.bottom = y.toFixed(0) + "px";
            this.style.top = "";
        }
        else {
            console.log(w + " " + h + " " + x + " " + y);
            if (x > w * 0.5) {
                this.style.right = x.toFixed(0) + "px";
                this.style.left = "";
            }
            else {
                this.style.right = "";
                this.style.left = x.toFixed(0) + "px";
            }
            if (y > h * 0.5) {
                this.style.bottom = (h - y).toFixed(0) + "px";
                this.style.top = "";
            }
            else {
                this.style.bottom = "";
                this.style.top = y.toFixed(0) + "px";
            }
        }
    }
    async show() {
        this._shown = true;
        this.style.display = "block";
    }
    async hide() {
        this._shown = false;
        this.style.display = "none";
        this.onColorIndexChanged = undefined;
    }
}
customElements.define("material-picker", MaterialPicker);
class MusicDisplay {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.game = game;
        this.w = 1600;
        this.h = 100;
        this.hideTimeout = -1;
        this.t0 = -1;
        this.tMax = 16;
        this.abcdefg = "ABCDEFG";
        this.context = canvas.getContext("2d");
        canvas.width = this.w;
        canvas.height = this.h;
    }
    show() {
        this.canvas.style.display = "block";
    }
    hide() {
        this.canvas.style.display = "none";
    }
    reset() {
        this.context.clearRect(0, 0, this.w, this.h);
        this.context.fillStyle = "white";
        for (let n = 0; n < 5; n++) {
            this.context.fillRect(this.w * 0.05, 30 + n * 10, this.w * 0.9, 1);
        }
        /*
        let x0 = Math.floor(this.w * 0.1);
        for (let n = 0; n <= 4; n++) {
            let x = Math.floor(x0 + n * this.w * 0.2);
            this.context.fillStyle = "white";
            this.context.fillRect(x, 40, 1, 120);
            if (n < 4) {
                for (let n2 = 0.25; n2 <= 0.75; n2 += 0.25) {
                    this.context.fillStyle = "gray";
                    this.context.fillRect(x0 + (n + n2) * this.w * 0.2, 40, 1, 120);
                }
            }
        }
            */
        this.t0 = -1;
        this.firstXylophone = undefined;
    }
    drawNote(xylophone) {
        this.show();
        if (this.t0 < 0 || xylophone === this.firstXylophone) {
            this.reset();
            this.t0 = this.game.factoredTimeSinceGameStart;
            this.firstXylophone = xylophone;
        }
        let noteName = Core.Xylophone.NotesName[xylophone.n];
        let letter = noteName[0];
        let octave = parseInt(noteName[1]);
        let y = this.h - (10 + 5 * this.abcdefg.indexOf(letter) + 35 * (octave - 5));
        let hashtag = noteName[2] === "#";
        let t = (this.game.factoredTimeSinceGameStart - this.t0);
        if (t > this.tMax) {
            this.reset();
            this.drawNote(xylophone);
            return;
        }
        let x = Math.floor((t / this.tMax) * this.w * 0.8 + this.w * 0.1);
        this.context.fillStyle = "white";
        this.context.beginPath();
        this.context.arc(x, y, 1, 0, 2 * Math.PI);
        this.context.closePath();
        this.context.fill();
        this.context.strokeStyle = "white";
        this.context.beginPath();
        this.context.arc(x, y, 4, 0, 2 * Math.PI);
        this.context.closePath();
        this.context.fill();
        clearTimeout(this.hideTimeout);
        this.hideTimeout = setTimeout(() => {
            this.hide();
        }, this.tMax * 1000 / this.game.currentTimeFactor);
    }
}
class ScreenLoger {
    static get container() {
        if (!ScreenLoger._container) {
            ScreenLoger._container = document.createElement("div");
            ScreenLoger._container.id = "screen-loger-container";
            ScreenLoger._container.style.display = "block";
            ScreenLoger._container.style.position = "fixed";
            ScreenLoger._container.style.left = "20px";
            ScreenLoger._container.style.top = "10px";
            ScreenLoger._container.style.zIndex = "1000000";
            ScreenLoger._container.style.color = "lime";
            ScreenLoger._container.style.pointerEvents = "none";
            document.body.appendChild(ScreenLoger._container);
        }
        return ScreenLoger._container;
    }
    static Log(s) {
        if (Game.Instance && Game.Instance.devMode && Game.Instance.devMode.activated || true) {
            let line = document.createElement("div");
            line.classList.add("screen-loger-line");
            line.style.fontFamily = "monospace";
            line.style.pointerEvents = "none";
            line.innerText = s;
            ScreenLoger.container.appendChild(line);
            if (ScreenLoger.container.childElementCount > 15) {
                ScreenLoger.container.removeChild(ScreenLoger.container.firstChild);
            }
        }
    }
}
class ShareMenuView extends HTMLElement {
    constructor() {
        super(...arguments);
        this._loaded = false;
        this._shown = false;
        this._shareBtnDefaultHTML = "";
        this._shareBtnWorkingHTML = "";
        this._devUpdateBtnDefaultHTML = "";
        this._devUpdateBtnWorkingHTML = "";
        this.currentPointers = 0;
        this.generatedUrl = "";
        this._communicating = false;
        this._eulaAccepted = false;
        this.isShared = false;
        this._timer = 0;
    }
    static get observedAttributes() {
        return [];
    }
    get loaded() {
        return this._loaded;
    }
    get shown() {
        return this._shown;
    }
    async waitLoaded() {
        return new Promise(resolve => {
            let wait = () => {
                if (this._loaded) {
                    resolve();
                }
                else {
                    requestAnimationFrame(wait);
                }
            };
            wait();
        });
    }
    get onLoad() {
        return this._onLoad;
    }
    set onLoad(callback) {
        this._onLoad = callback;
        if (this._loaded) {
            this._onLoad();
        }
    }
    currentPointerUp() {
        if (this._options.length > 0) {
            this.setPointer((this.currentPointers - 1 + this._options.length) % this._options.length);
        }
    }
    currentPointerDown() {
        if (this._options.length > 0) {
            this.setPointer((this.currentPointers + 1) % this._options.length);
        }
    }
    setPointer(n) {
        if (this._options[this.currentPointers]) {
            this._options[this.currentPointers].classList.remove("highlit");
        }
        this.currentPointers = n;
        if (this._options[this.currentPointers]) {
            this._options[this.currentPointers].classList.add("highlit");
        }
    }
    connectedCallback() {
        this.classList.add("popup-menu");
        this.style.display = "none";
        this.style.opacity = "0";
        this.addEventListener("pointerdown", StopPointerProgatation);
        this.addEventListener("pointermove", StopPointerProgatation);
        this.addEventListener("pointerup", StopPointerProgatationAndMonkeys);
        this._title = document.createElement("h1");
        this._title.classList.add("share-menu-title");
        this._title.innerHTML = '<i18n-text text-key="share-menu-title"></i18n-text>';
        this.appendChild(this._title);
        let container;
        container = document.createElement("div");
        this.appendChild(container);
        let titleDiv = document.createElement("div");
        titleDiv.classList.add("line");
        container.appendChild(titleDiv);
        this._machineTitleLabel = document.createElement("span");
        this._machineTitleLabel.classList.add("share-label");
        this._machineTitleLabel.innerHTML = "標題";
        titleDiv.appendChild(this._machineTitleLabel);
        this._machineTitleInput = document.createElement("input");
        this._machineTitleInput.type = "text";
        titleDiv.appendChild(this._machineTitleInput);
        let authorDiv = document.createElement("div");
        authorDiv.classList.add("line");
        container.appendChild(authorDiv);
        this._machineAuthorLabel = document.createElement("span");
        this._machineAuthorLabel.classList.add("share-label");
        this._machineAuthorLabel.innerHTML = "作者";
        authorDiv.appendChild(this._machineAuthorLabel);
        this._machineAuthorInput = document.createElement("input");
        this._machineAuthorInput.type = "text";
        authorDiv.appendChild(this._machineAuthorInput);
        let countryDiv = document.createElement("div");
        countryDiv.classList.add("line");
        container.appendChild(countryDiv);
        this._machineCountryLabel = document.createElement("span");
        this._machineCountryLabel.classList.add("share-label");
        this._machineCountryLabel.innerHTML = "國家/地區";
        countryDiv.appendChild(this._machineCountryLabel);
        this._machineCountryInput = document.createElement("select");
        this._machineCountryInput.innerHTML = `
            <button>
                <selectedcontent></selectedcontent>
            </button>
        `;
        for (let i = 0; i < ExistingCountryFlags.length; i++) {
            let opt = document.createElement("option");
            opt.value = ExistingCountryFlags[i].code;
            let icon = document.createElement("span");
            icon.classList.add("fi", "fi-" + ExistingCountryFlags[i].code);
            icon.style.marginRight = "5px";
            opt.appendChild(icon);
            let countryName = document.createElement("span");
            countryName.innerHTML = ExistingCountryFlags[i].name;
            opt.appendChild(countryName);
            this._machineCountryInput.appendChild(opt);
        }
        countryDiv.appendChild(this._machineCountryInput);
        // Try to auto-detect country based on lang.
        let lang = navigator.language;
        let countryVal = "un";
        if (lang) {
            let splitLang = lang.split("-")[1];
            if (splitLang) {
                countryVal = splitLang.toLocaleLowerCase();
            }
            else {
                countryVal = lang;
            }
        }
        if (ExistingCountryFlags.find(flag => { return flag.code === countryVal; })) {
            this._machineCountryInput.value = countryVal;
        }
        this._shareInfo = document.createElement("div");
        this._shareInfo.innerHTML = `
            <p><i18n-text text-key="share-menu-notice"></i18n-text></p>
        `;
        let p = document.createElement("p");
        let readEulaBtn = document.createElement("button");
        readEulaBtn.classList.add("inline-button");
        readEulaBtn.innerHTML = '<i18n-text text-key="share-menu-read-btn"></i18n-text>';
        readEulaBtn.onclick = () => {
            this.game.eulaPage.show(0.3);
        };
        p.appendChild(readEulaBtn);
        this._shareInfo.appendChild(p);
        container.appendChild(this._shareInfo);
        this._eulaLine = document.createElement("div");
        this._eulaLine.classList.add("line");
        this.eulaCheckbox = document.createElement("nabu-checkbox");
        this.eulaCheckbox.value = 0;
        this.eulaCheckbox.onChange = () => {
            this.setEulaAccepted(this.eulaCheckbox.value === 1);
        };
        this._eulaLine.appendChild(this.eulaCheckbox);
        let eulaLabel = document.createElement("span");
        eulaLabel.classList.add("label");
        eulaLabel.innerHTML = '<i18n-text text-key="share-menu-checkbox-label"></i18n-text>';
        this._eulaLine.appendChild(eulaLabel);
        container.appendChild(this._eulaLine);
        this._shareBtn = document.createElement("button");
        this._shareBtn.classList.add("large-button", "disabled");
        this._shareBtnDefaultHTML = '<i18n-text text-key="share-menu-btn-confirm"></i18n-text>' + `&nbsp;&nbsp;&nbsp;<span style="font-weight: 100">（網路）</span>`;
        this._shareBtnWorkingHTML = '<i18n-text text-key="share-menu-btn-comm"></i18n-text>';
        this._shareBtn.innerHTML = this._shareBtnDefaultHTML;
        container.appendChild(this._shareBtn);
        this._shareBtn.onclick = async () => {
            if (this._eulaAccepted && !this.game.OFFLINE_MODE) {
                if (this._communicating) {
                    return;
                }
                this._errorMessage.style.display = "none";
                if (Nabu.ContainsBadwords(this._machineTitleInput.value)) {
                    this._errorMessage.style.display = "block";
                    this._errorMessage.innerHTML = `
                        <i18n-text text-key="share-menu-title-badword"></i18n-text>
                    `;
                    return;
                }
                if (Nabu.ContainsBadwords(this._machineAuthorInput.value)) {
                    this._errorMessage.style.display = "block";
                    this._errorMessage.innerHTML = `
                        <i18n-text text-key="share-menu-author-badword"></i18n-text>
                    `;
                    return;
                }
                this._communicating = true;
                this._shareBtn.innerHTML = this._shareBtnWorkingHTML;
                setTimeout(async () => {
                    let serializedMachine = this.game.machine.serialize();
                    this.game.machine.name = this._machineTitleInput.value;
                    this.game.machine.author = this._machineAuthorInput.value;
                    let data = {
                        version: serializedMachine.v,
                        mode: this.game.machine.constructionMode,
                        title: this.game.machine.name,
                        author: this.game.machine.author,
                        country: this._machineCountryInput.value,
                        parentId: this.game.machine.dbId,
                        content: serializedMachine.content
                    };
                    console.log("publish");
                    console.log(data);
                    let dataString = JSON.stringify(data);
                    try {
                        const response = await fetch(SHARE_SERVICE_PATH + "publish_machine", {
                            method: "POST",
                            mode: "cors",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: dataString,
                        });
                        const machineId = await response.text();
                        console.log("Published machineID = " + machineId);
                        const params = {
                            machineId: machineId
                        };
                        let pokiUrl = await PokiSDK.shareableURL(params);
                        this.generatedUrl = pokiUrl;
                        this.isShared = true;
                        this._sharedUrl.querySelector(".value").setAttribute("value", this.generatedUrl);
                        this.updateStatus();
                        this._shareBtn.innerHTML = this._shareBtnDefaultHTML;
                        this._communicating = false;
                        if (!response.ok) {
                            throw new Error("Response status: " + response.status);
                        }
                    }
                    catch (e) {
                        console.error(e);
                        this._errorMessage.style.display = "block";
                        this._errorMessage.innerHTML = `
                            <i18n-text text-key="share-menu-error"></i18n-text>
                        `;
                        this._shareBtn.innerHTML = this._shareBtnDefaultHTML;
                        this._communicating = false;
                    }
                }, 1000);
            }
        };
        this.devUpdateBtn = document.createElement("button");
        this.devUpdateBtn.style.display = "none";
        this.devUpdateBtn.classList.add("large-button");
        this._devUpdateBtnDefaultHTML = '更新' + `&nbsp;&nbsp;&nbsp;<span style="font-weight: 100">（開發）</span>`;
        this._devUpdateBtnWorkingHTML = '<i18n-text text-key="share-menu-btn-comm"></i18n-text>';
        this.devUpdateBtn.innerHTML = this._devUpdateBtnDefaultHTML;
        container.appendChild(this.devUpdateBtn);
        this.devUpdateBtn.onclick = async () => {
            if (this._communicating) {
                return;
            }
            this._errorMessage.style.display = "none";
            this._communicating = true;
            this.devUpdateBtn.innerHTML = this._devUpdateBtnWorkingHTML;
            setTimeout(async () => {
                let serializedMachine = this.game.machine.serialize();
                this.game.machine.name = this._machineTitleInput.value;
                this.game.machine.author = this._machineAuthorInput.value;
                this.game.machine.country = this._machineCountryInput.value;
                let data = {
                    id: this.game.machine.dbId,
                    version: serializedMachine.v,
                    mode: this.game.machine.constructionMode,
                    title: this.game.machine.name,
                    author: this.game.machine.author,
                    country: this.game.machine.country,
                    content: serializedMachine.content
                };
                let dataString = JSON.stringify(data);
                try {
                    let headers = {
                        "Content-Type": "application/json",
                        "Authorization": 'Basic ' + btoa("carillon:" + this.game.devMode.getPassword())
                    };
                    const response = await fetch(SHARE_SERVICE_PATH + "publish_machine", {
                        method: "POST",
                        mode: "cors",
                        headers: headers,
                        body: dataString,
                    });
                    const machineId = await response.text();
                    console.log("Updated machineID = " + machineId);
                    const params = {
                        machineId: machineId
                    };
                    let pokiUrl = await PokiSDK.shareableURL(params);
                    this.generatedUrl = pokiUrl;
                    this.isShared = true;
                    this._sharedUrl.querySelector(".value").setAttribute("value", this.generatedUrl);
                    this.updateStatus();
                    this.devUpdateBtn.innerHTML = this._devUpdateBtnDefaultHTML;
                    this._communicating = false;
                    if (!response.ok) {
                        throw new Error("Response status: " + response.status);
                    }
                }
                catch (e) {
                    console.error(e);
                    this._errorMessage.style.display = "block";
                    this._errorMessage.innerHTML = `
                        <i18n-text text-key="share-menu-error"></i18n-text>
                    `;
                    this.devUpdateBtn.innerHTML = this._devUpdateBtnDefaultHTML;
                    this._communicating = false;
                }
            }, 500);
        };
        this._errorMessage = document.createElement("div");
        this._errorMessage.classList.add("error-message");
        this._errorMessage.style.display = "none";
        this._errorMessage.innerHTML = `
            <i18n-text text-key="share-menu-error"></i18n-text>
        `;
        container.appendChild(this._errorMessage);
        this._saveInfo = document.createElement("div");
        //this._saveInfo.innerHTML = `
        //    <p><i18n-text text-key="share-menu-save-notice"></i18n-text></p>
        //`;
        container.appendChild(this._saveInfo);
        this._sharedUrl = document.createElement("div");
        this._sharedUrl.classList.add("shared-url");
        container.appendChild(this._sharedUrl);
        let sharedUrlValue = document.createElement("input");
        sharedUrlValue.classList.add("value");
        sharedUrlValue.setAttribute("readonly", "readonly");
        this._sharedUrl.appendChild(sharedUrlValue);
        let sharedUrlCopy = document.createElement("button");
        sharedUrlCopy.classList.add("copy");
        sharedUrlCopy.onclick = () => {
            navigator.clipboard.writeText(this.generatedUrl);
        };
        this._sharedUrl.appendChild(sharedUrlCopy);
        let externalLink = document.createElement("a");
        externalLink.setAttribute("target", "_blank");
        this._sharedUrl.appendChild(externalLink);
        let sharedUrlOpen = document.createElement("button");
        sharedUrlOpen.classList.add("open");
        externalLink.appendChild(sharedUrlOpen);
        this._shareMessage = document.createElement("div");
        this._shareMessage.innerHTML = '<p><i18n-text text-key="share-menu-outro"></i18n-text></p>';
        container.appendChild(this._shareMessage);
        let bottomLine = document.createElement("div");
        bottomLine.style.width = "100%";
        bottomLine.style.textAlign = "center";
        this._saveBtn = document.createElement("button");
        this._saveBtn.classList.add("medium-button");
        this._saveBtn.innerHTML = '<i18n-text text-key="share-menu-btn-save"></i18n-text>' + `&nbsp;&nbsp;&nbsp;<span style="font-weight: 100">(local)</span>`;
        bottomLine.appendChild(this._saveBtn);
        this._saveBtn.onclick = async () => {
            let data = this.game.machine.serialize();
            let dataString = JSON.stringify(data);
            Nabu.download("my-marble-machine.json", dataString);
        };
        this._returnBtn = document.createElement("button");
        this._returnBtn.classList.add("medium-button");
        this._returnBtn.innerHTML = '<i18n-text text-key="btn-back"></i18n-text>';
        bottomLine.appendChild(this._returnBtn);
        this._returnBtn.onclick = () => {
            this.hide(0.1);
        };
        container.appendChild(bottomLine);
        this._loaded = true;
        this._options = [
            this._shareBtn,
            this._returnBtn
        ];
    }
    attributeChangedCallback(name, oldValue, newValue) { }
    async show(duration = 0.3) {
        this.game.popupShade.style.display = "block";
        this.game.popupShade.style.opacity = "0.5";
        return new Promise((resolve) => {
            if (!this._shown) {
                this._shown = true;
                this.style.display = "block";
                this.reset();
                let opacity0 = parseFloat(this.style.opacity);
                let opacity1 = 1;
                let t0 = performance.now();
                let step = () => {
                    let t = performance.now();
                    let dt = (t - t0) / 1000;
                    if (dt >= duration) {
                        this.style.opacity = "1";
                        //this.game.eulaPage.show(0);
                        PokiGameplayStop();
                        resolve();
                    }
                    else {
                        let f = dt / duration;
                        this.style.opacity = ((1 - f) * opacity0 + f * opacity1).toFixed(2);
                        requestAnimationFrame(step);
                    }
                };
                step();
            }
        });
    }
    async hide(duration = 0.3) {
        if (duration === 0) {
            this.game.popupShade.style.opacity = "0";
            this.game.popupShade.style.display = "none";
            if (this._shown) {
                PokiGameplayStart();
            }
            this._shown = false;
            this.style.display = "none";
            this.style.opacity = "0";
        }
        else {
            this.game.popupShade.style.opacity = "0";
            setTimeout(() => {
                this.game.popupShade.style.display = "none";
            }, duration * 1000);
            return new Promise((resolve) => {
                if (this._shown) {
                    if (this._shown) {
                        PokiGameplayStart();
                    }
                    this._shown = false;
                    this.style.display = "block";
                    let opacity0 = parseFloat(this.style.opacity);
                    let opacity1 = 0;
                    let t0 = performance.now();
                    let step = () => {
                        let t = performance.now();
                        let dt = (t - t0) / 1000;
                        if (dt >= duration) {
                            this.style.display = "none";
                            this.style.opacity = "0";
                            if (this.onNextHide) {
                                this.onNextHide();
                                this.onNextHide = undefined;
                            }
                            resolve();
                        }
                        else {
                            let f = dt / duration;
                            this.style.opacity = ((1 - f) * opacity0 + f * opacity1).toFixed(2);
                            requestAnimationFrame(step);
                        }
                    };
                    step();
                }
            });
        }
    }
    setEulaAccepted(v) {
        this._eulaAccepted = v;
        if (this._eulaAccepted) {
            this._shareBtn.classList.remove("disabled");
        }
        else {
            this._shareBtn.classList.add("disabled");
        }
    }
    setGame(game) {
        this.game = game;
        if (this.game.devMode.activated) {
            this.devUpdateBtn.style.display = "";
        }
    }
    update(dt) {
        if (this._timer > 0) {
            this._timer -= dt;
        }
    }
    reset() {
        this.eulaCheckbox.value = 0;
        this.isShared = false;
        this._machineTitleInput.value = this.game.machine.name;
        this._machineAuthorInput.value = this.game.machine.author;
        if (this.game.machine.country != "") {
            this._machineCountryInput.value = this.game.machine.country;
        }
        this._sharedUrl.querySelector(".value").setAttribute("value", "");
        this.updateStatus();
    }
    updateStatus() {
        this._errorMessage.style.display = "none";
        if (this.isShared) {
            this._shareInfo.style.display = "none";
            this._eulaLine.style.display = "none";
            this._saveInfo.style.display = "none";
            this._shareBtn.style.display = "none";
            this._saveBtn.style.display = "none";
            this._returnBtn.style.display = "inline-block";
            this._sharedUrl.style.display = "block";
            this._shareMessage.style.display = "block";
            this._sharedUrl.querySelector("a").href = this.generatedUrl;
        }
        else {
            this._shareInfo.style.display = "block";
            this._eulaLine.style.display = "block";
            this._saveInfo.style.display = "block";
            this._shareBtn.style.display = this.game.OFFLINE_MODE ? "none" : "block";
            this._saveBtn.style.display = "none";
            this._returnBtn.style.display = "inline-block";
            this._sharedUrl.style.display = "none";
            this._shareMessage.style.display = "none";
            this._sharedUrl.querySelector("a").href = "";
        }
    }
}
customElements.define("share-menu", ShareMenuView);
class SvgArrow {
    constructor(name, game, baseSize = 0.1, distanceFromTarget = 0, dirInDegrees) {
        this.game = game;
        this.baseSize = baseSize;
        this.distanceFromTarget = distanceFromTarget;
        this.dirInDegrees = dirInDegrees;
        this._animationSlideInterval = 0;
        this.image = document.createElement("nabu-popup");
        this.image.style.position = "fixed";
        this.image.style.transformOrigin = "center";
        this.image.style.transform = "rotate(" + this.dirInDegrees + "deg)";
        this.image.style.pointerEvents = "none";
        this.image.style.zIndex = "2";
        document.body.appendChild(this.image);
    }
    setTarget(e) {
        if (e) {
            let rect = e.getBoundingClientRect();
            this.image.style.top = (rect.top + rect.height * 0.5 - this._w * 1.5 * 0.5).toFixed(1) + "px";
            this.image.style.left = (rect.left + rect.width * 0.5 - this._w * 0.5).toFixed(1) + "px";
        }
    }
    setTargetXY(x, y) {
        this.image.style.left = x.toFixed(1) + "px";
        this.image.style.top = y.toFixed(1) + "px";
    }
    async instantiate() {
        this.image.innerHTML = `
            <svg viewBox="0 0 200 300">
                <path d="M100 150 L125 200 L109 200 L109 250 L91 250 L91 200 L75 200 Z" fill="#baccc8" stroke="#baccc8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
        `;
        let svg = this.image.querySelector("svg");
        this._w = (Math.min(window.innerWidth, window.innerHeight) * this.baseSize);
        svg.style.width = this._w.toFixed(1) + "px";
        let d = (Math.min(window.innerWidth, window.innerHeight) * this.baseSize * this.distanceFromTarget);
        svg.style.transform = "translate(0px, " + d.toFixed(1) + "px)";
    }
    show(duration) {
        return this.image.show(duration);
    }
    hide(duration) {
        clearInterval(this._animationSlideInterval);
        return this.image.hide(duration);
    }
    async slide(x, y, targetDir, duration = 1, easing) {
        return new Promise(resolve => {
            clearInterval(this._animationSlideInterval);
            let x0 = parseFloat(this.image.style.left);
            let y0 = parseFloat(this.image.style.top);
            let x1 = x - this._w * 0.5;
            let y1 = y - this._w * 1.5 * 0.5;
            let dir0 = this.dirInDegrees;
            let t0 = performance.now() / 1000;
            this._animationSlideInterval = setInterval(() => {
                let t = performance.now() / 1000 - t0;
                if (t >= duration) {
                    clearInterval(this._animationSlideInterval);
                    this.dirInDegrees = targetDir;
                    this.image.style.transform = "rotate(" + this.dirInDegrees + "deg)";
                    this.image.style.left = x1.toFixed(1) + "px";
                    this.image.style.top = y1.toFixed(1) + "px";
                    resolve();
                }
                else {
                    let f = t / duration;
                    if (easing) {
                        f = easing(f);
                    }
                    this.dirInDegrees = (1 - f) * dir0 + f * targetDir;
                    this.image.style.transform = "rotate(" + this.dirInDegrees + "deg)";
                    this.image.style.left = ((1 - f) * x0 + f * x1).toFixed(1) + "px";
                    this.image.style.top = ((1 - f) * y0 + f * y1).toFixed(1) + "px";
                }
            }, 15);
        });
    }
    dispose() {
        clearInterval(this._animationSlideInterval);
        if (this.image.parentElement === document.body) {
            document.body.removeChild(this.image);
        }
    }
}
class TextHelper {
    constructor(textContent, game) {
        this.game = game;
        this.lastShownTime = 0;
        this.ignoredCount = 0;
        this._onClickOutside = () => {
            if (this.onClickOutsideCallback) {
                this.onClickOutsideCallback();
            }
        };
        this._onIgnoreBtnClick = () => {
            this.hide(0);
            this.ignoredCount++;
        };
        this._onOkBtnClick = () => {
            this.hide(0);
            if (this.onOkCallback) {
                this.onOkCallback();
            }
        };
        this.contentBox = document.createElement("nabu-popup");
        this.contentBox.classList.add("text-helper");
        this._text = document.createElement("span");
        this._text.innerHTML = textContent;
        this.contentBox.appendChild(this._text);
        let corner = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        corner.setAttribute("viewBox", "0 0 100 100");
        corner.innerHTML = `
            <path d="M30 0 L100 0 L100 70Z" fill="white" stroke="none"></path>
            <path d="M0 0 L100 100" fill="none" stroke="white" stroke-width="5"></path>
        `;
        corner.style.width = "20px";
        corner.style.height = "20px";
        corner.style.position = "absolute";
        corner.style.top = "-0.5px";
        corner.style.right = "-0.5px";
        this.contentBox.appendChild(corner);
        let footer = document.createElement("div");
        footer.classList.add("footer");
        this.contentBox.appendChild(footer);
        let ignore = document.createElement("button");
        ignore.classList.add("ignore");
        ignore.innerText = "忽略";
        ignore.onclick = this._onIgnoreBtnClick;
        footer.appendChild(ignore);
        let okBtn = document.createElement("button");
        okBtn.classList.add("accept");
        okBtn.innerText = "確定";
        okBtn.onclick = this._onOkBtnClick;
        footer.appendChild(okBtn);
        this.contentBox.style.display = "none";
        document.body.appendChild(this.contentBox);
    }
    setTarget(e) {
        let rect = e.getBoundingClientRect();
        this.contentBox.style.top = (rect.bottom + 5).toFixed(1) + "px";
        this.contentBox.style.right = Math.max(0, Math.min((window.innerWidth - Math.min(0.46 * window.innerHeight, 0.58 * window.innerWidth)), (window.innerWidth - rect.left + 5))).toFixed(1) + "px";
    }
    setTargetXY(x, y) {
        this.contentBox.style.left = x.toFixed(1) + "px";
        this.contentBox.style.top = y.toFixed(1) + "px";
    }
    setContent(content) {
        this._text.innerHTML = content;
    }
    get shown() {
        return this.contentBox.shown;
    }
    async show(duration) {
        await this.contentBox.show(duration);
        this.lastShownTime = performance.now();
        document.addEventListener("click", this._onClickOutside);
        return;
    }
    hide(duration) {
        document.removeEventListener("click", this._onClickOutside);
        return this.contentBox.hide(duration);
    }
    dispose() {
        if (this.contentBox.parentElement === document.body) {
            document.body.removeChild(this.contentBox);
        }
    }
}
class AutoPlayer {
    constructor(game) {
        this.game = game;
        this._replayTimer = 0;
        this._runTimer = 0;
        this._wasPlaying = false;
    }
    get enabled() {
        return this.game.config && this.game.config.getValue("autoPlay") == true;
    }
    update(rawDT) {
        if (!this.game.machine) { return; }
        if (!isFinite(rawDT)) { return; }
        if (!this.enabled) {
            this._replayTimer = 0;
            this._runTimer = 0;
            this._wasPlaying = false;
            return;
        }
        let mode = this.game.mode;
        if (mode === GameMode.Home || mode === GameMode.BBPuzzle || mode === GameMode.Create) { return; }
        if (mode === GameMode.Challenge) {
            let challenge = this.game.challenge;
            if (!challenge) { return; }
            let finished = challenge.state >= 100 || challenge.failure;
            if (finished) {
                this._runTimer = 0;
                this._replayTimer += rawDT;
                let delay = challenge.state >= 100 ? 2.5 : 1.5;
                if (this._replayTimer > delay) {
                    this._replayTimer = 0;
                    if (challenge.state >= 100) { challenge.state = 0; }
                    challenge.failure = false;
                    challenge.start();
                }
                return;
            }
            this._replayTimer = 0;
            if (challenge.mode === ChallengeMode.Parkour && this.game.machine.playing) {
                this._autoBoost(challenge);
            }
            return;
        }
        this._spectator(rawDT);
    }
    _autoBoost(challenge) {
        let ball = this.game.machine.balls[0];
        if (!ball || !ball.velocity) { return; }
        let vy = ball.velocity.y;
        if (vy < -0.02) { ball.boosting = true; }
        else if (vy > 0.02) { ball.boosting = false; }
    }
    _spectator(rawDT) {
        let machine = this.game.machine;
        if (machine.playing) {
            this._runTimer += rawDT;
            this._wasPlaying = true;
            this._replayTimer = 0;
            if (this._runTimer > 120) {
                this._runTimer = 0;
                machine.stop();
                machine.play();
            }
            return;
        }
        if (this._wasPlaying) {
            this._runTimer = 0;
            this._replayTimer += rawDT;
            if (this._replayTimer > 1.5) {
                this._replayTimer = 0;
                this._wasPlaying = false;
                machine.play();
            }
        }
        else {
            this._replayTimer += rawDT;
            if (this._replayTimer > 1.0) {
                this._replayTimer = 0;
                this._wasPlaying = false;
                machine.play();
            }
        }
    }
}
class Toolbar {
    constructor(game) {
        this.game = game;
        this.timeFactorInputShown = false;
        this.loadInputShown = false;
        this.soundInputShown = false;
        this.editInputShown = false;
        this.shareInputShown = false;
        this.autoButton = null;
        this._tick = 0;
        this._tickDuration = 15;
        this._udpate = () => {
            if (this.game.machine) {
                this.reloadingContainer.style.display = (!PlayerHasInteracted || this.game.machine.instantiated) ? "none" : "block";
                if (this.reloadingContainer.style.display === "block") {
                    if (this._tick < this._tickDuration * 1) {
                        this.reloadingContainer.innerHTML = "重建中";
                    }
                    else if (this._tick < this._tickDuration * 2) {
                        this.reloadingContainer.innerHTML = "重建中.";
                    }
                    else if (this._tick < this._tickDuration * 3) {
                        this.reloadingContainer.innerHTML = "重建中..";
                    }
                    else if (this._tick < this._tickDuration * 4) {
                        this.reloadingContainer.innerHTML = "重建中...";
                    }
                    else if (this._tick < this._tickDuration * 5) {
                        this.reloadingContainer.innerHTML = "重建中....";
                    }
                    else if (this._tick > this._tickDuration * 5) {
                        this._tick = 0;
                    }
                    this._tick++;
                }
                else {
                    this._tick = 0;
                }
                if (this.boostButton.style.display === "") {
                    if (this.game.machine.stopped) {
                        this.boostButtonLabel.innerHTML = "開始";
                        this.boostButton.setAttribute("state", "start");
                    }
                    else {
                        this.boostButtonLabel.innerHTML = "加重";
                        let ball = this.game.machine.balls[0];
                        if (ball) {
                            this.boostButton.setAttribute("state", ball.boosting ? "boost" : "");
                        }
                    }
                }
                if (this.game.machine.playing != this._lastPlaying) {
                    if (this.game.machine.playing) {
                        this.playButton.style.display = "none";
                        this.pauseButton.style.display = "";
                    }
                    else {
                        this.playButton.style.display = "";
                        this.pauseButton.style.display = "none";
                    }
                    this._lastPlaying = this.game.machine.playing;
                    this.resize();
                }
                this.timeFactorValue.innerText = this.game.currentTimeFactor.toFixed(2);
                this._syncAutoButton();
            }
        };
        this.onBoostDown = () => {
            if (!this.game.machine.stopped) {
                if (this.game.machine.balls[0]) {
                    this.game.machine.balls[0].boosting = true;
                }
            }
        };
        this.onBoostUp = () => {
            if (this.game.machine.stopped) {
                if (this.game.mode === GameMode.Challenge) {
                    this.game.challenge.start();
                }
                else {
                    this.game.machine.play();
                }
            }
            else if (this.game.machine.balls[0]) {
                this.game.machine.balls[0].boosting = false;
            }
        };
        this.onPlay = () => {
            if (!this.playButton.classList.contains("inactive")) {
                this.game.machine.play();
                if (this.game.machineEditor) {
                    this.game.machineEditor.setSelectedObject(undefined);
                }
            }
        };
        this.onPause = () => {
            if (!this.pauseButton.classList.contains("inactive")) {
                this.game.machine.pause();
            }
        };
        this.onStop = () => {
            if (!this.stopButton.classList.contains("inactive")) {
                this.game.machine.stop();
            }
        };
        this.onAutoToggle = () => {
            let current = this.game.config.getValue("autoPlay") == true;
            this.game.config.setValue("autoPlay", current ? 0 : 1);
            this._syncAutoButton();
        };
        this._syncAutoButton = () => {
            if (!this.autoButton) { return; }
            let on = this.game.config && this.game.config.getValue("autoPlay") == true;
            this.autoButton.classList.toggle("active", on);
            this.autoButton.setAttribute("state", on ? "on" : "");
        };
        this.onTimeFactorButton = () => {
            this.timeFactorInputShown = !this.timeFactorInputShown;
            this.resize();
        };
        this.onTimeFactorInput = (e) => {
            this.game.targetTimeFactor = parseFloat(e.target.value);
        };
        this.onCamPrevButton = () => {
            this.game.setCameraMode(this.game.cameraMode - 1);
            this.resize();
        };
        this.onCamNextButton = () => {
            this.game.setCameraMode(this.game.cameraMode + 1);
            this.resize();
        };
        this.onSoundButton = () => {
            this.soundInputShown = !this.soundInputShown;
            this.resize();
        };
        this.onSoundInput = (e) => {
            BABYLON.Engine.audioEngine.setGlobalVolume(parseFloat(e.target.value));
        };
        this.onZoomOutButton = () => {
            this.game.setCameraZoomFactor(this.game.getCameraZoomFactor() - 0.05);
        };
        this.onZoomInButton = () => {
            this.game.setCameraZoomFactor(this.game.getCameraZoomFactor() + 0.05);
        };
        this.onEditButton = () => {
            if (this.game.machine.instantiated) {
                this.editInputShown = !this.editInputShown;
            }
            this.resize();
        };
        this.onPhotoButton = () => {
            this.game.photoMaker.toggle();
        };
        this.onShareButton = async () => {
            this.shareInputShown = !this.shareInputShown;
            if (this.shareInputShown) {
                const params = {
                    machineId: this.game.machine.dbId
                };
                let pokiUrl = await PokiSDK.shareableURL(params);
                this.shareInput.value = pokiUrl;
                document.querySelector("#toolbar-share-id").innerHTML = "<i18n-text text-key='toolbar-share-label'></i18n-text>" + this.game.machine.dbId.toFixed(0);
                this.shareInputContainer.querySelector(".copy").onclick = () => {
                    navigator.clipboard.writeText(pokiUrl);
                };
            }
            this.resize();
        };
        this.onLikeButton = async () => {
            let id = this.game.machine.dbId;
            if (isFinite(id)) {
                if (this.game.devMode.activated) {
                    await this.game.likeManager.like(id);
                }
                else {
                    if (this.game.likeManager.isLiked(id)) {
                        await this.game.likeManager.unlike(id);
                    }
                    else {
                        await this.game.likeManager.like(id);
                    }
                }
                this.updateButtonsVisibility();
            }
        };
        this.onLayer = (e) => {
            let rect = this.layerButton.getBoundingClientRect();
            let centerY = rect.top + rect.height * 0.5;
            if (e.y > centerY) {
                //this.game.machineEditor.currentLayer++;
            }
            else {
                //this.game.machineEditor.currentLayer--;
            }
        };
        this.closeAllDropdowns = () => {
            if (this.timeFactorInputShown || this.loadInputShown || this.soundInputShown || this.editInputShown || this.shareInputShown) {
                this.timeFactorInputShown = false;
                this.loadInputShown = false;
                this.soundInputShown = false;
                this.editInputShown = false;
                this.shareInputShown = false;
                this.resize();
            }
        };
    }
    initialize() {
        this.container = document.querySelector("#toolbar");
        this.container.style.display = "block";
        this.container.addEventListener("pointerdown", StopPointerProgatation);
        this.container.addEventListener("pointermove", StopPointerProgatation);
        this.container.addEventListener("pointerup", StopPointerProgatationAndMonkeys);
        this.devModeToolbar = this.container.querySelector("#dev-mode-toolbar");
        this.reloadingContainer = document.querySelector("#machine-reload-status");
        this.boostButton = document.querySelector("#toolbar-boost");
        this.boostButton.addEventListener("pointerdown", this.onBoostDown);
        this.boostButton.addEventListener("pointerup", this.onBoostUp);
        this.boostButtonLabel = document.querySelector("#toolbar-boost-label");
        this.boostButtonInfo = document.querySelector("#toolbar-boost-info");
        this.playButton = document.querySelector("#toolbar-play");
        this.playButton.addEventListener("click", this.onPlay);
        this.pauseButton = document.querySelector("#toolbar-pause");
        this.pauseButton.addEventListener("click", this.onPause);
        this.stopButton = document.querySelector("#toolbar-stop");
        this.stopButton.addEventListener("click", this.onStop);
        this.autoButton = document.querySelector("#toolbar-auto");
        if (this.autoButton) {
            this.autoButton.addEventListener("click", this.onAutoToggle);
        }
        this._syncAutoButton();
        this.timeFactorButton = document.querySelector("#toolbar-time-factor");
        this.timeFactorButton.addEventListener("click", this.onTimeFactorButton);
        this.timeFactorValue = document.querySelector("#toolbar-time-factor .value");
        this.timeFactorInput = document.querySelector("#time-factor-value");
        this.timeFactorInput.value = this.game.targetTimeFactor.toFixed(2);
        this.timeFactorInput.addEventListener("input", this.onTimeFactorInput);
        this.timeFactorInputContainer = this.timeFactorInput.parentElement;
        this.soundButton = document.querySelector("#toolbar-sound");
        this.soundButton.addEventListener("click", this.onSoundButton);
        this.soundInput = document.querySelector("#sound-value");
        this.soundInput.value = BABYLON.Engine.audioEngine.getGlobalVolume().toFixed(2);
        this.soundInput.addEventListener("input", this.onSoundInput);
        this.soundInputContainer = this.soundInput.parentElement;
        this.zoomOutButton = document.querySelector("#toolbar-zoom-out");
        this.zoomOutButton.addEventListener("click", this.onZoomOutButton);
        this.zoomInButton = document.querySelector("#toolbar-zoom-in");
        this.zoomInButton.addEventListener("click", this.onZoomInButton);
        this.layerButton = document.querySelector("#toolbar-layer");
        this.layerButton.addEventListener("click", this.onLayer);
        this.editButton = document.querySelector("#toolbar-edit");
        this.editButton.addEventListener("click", this.onEditButton);
        this.editInputContainer = document.querySelector("#toolbar-edit-dropdown");
        let editInputContainerButton = this.editInputContainer.querySelector("button");
        editInputContainerButton.onclick = () => {
            if (this.game.machine.instantiated) {
                location.hash = "#editor";
            }
        };
        this.photoButton = document.querySelector("#toolbar-screenshot");
        this.photoButton.addEventListener("click", this.onPhotoButton);
        this.shareButton = document.querySelector("#toolbar-share");
        this.shareButton.addEventListener("click", this.onShareButton);
        this.shareInput = document.querySelector("#toolbar-share-value");
        this.shareInput.value = "";
        this.shareInputContainer = this.shareInput.parentElement.parentElement;
        this.likeButton = document.querySelector("#toolbar-like");
        this.likeButton.addEventListener("click", this.onLikeButton);
        this.resize();
        this.game.canvas.addEventListener("pointerdown", this.closeAllDropdowns);
        this.game.scene.onBeforeRenderObservable.add(this._udpate);
    }
    dispose() {
        this.game.canvas.removeEventListener("pointerdown", this.closeAllDropdowns);
        this.game.scene.onBeforeRenderObservable.removeCallback(this._udpate);
        if (this.container) {
            this.container.removeEventListener("pointerdown", StopPointerProgatation);
            this.container.removeEventListener("pointermove", StopPointerProgatation);
            this.container.removeEventListener("pointerup", StopPointerProgatationAndMonkeys);
        }
    }
    updateButtonsVisibility() {
        this.devModeToolbar.style.display = "none";
        if (this.autoButton) { this.autoButton.style.display = "none"; }
        if (BB_PUZZLE_ONLY) {
            this.container.style.display = "none";
        }
        else if (this.game.mode === GameMode.Home) {
            this.container.style.display = "block";
            this.loadInputShown = false;
            this.editButton.style.display = "none";
            this.photoButton.style.display = "none";
            this.shareButton.style.display = "none";
            this.likeButton.style.display = "none";
            this.boostButton.style.display = "none";
        }
        else if (this.game.mode === GameMode.Page) {
            this.container.style.display = "block";
            this.loadInputShown = false;
            this.editButton.style.display = "none";
            this.photoButton.style.display = "none";
            this.shareButton.style.display = "none";
            this.likeButton.style.display = "none";
            this.boostButton.style.display = "none";
            this.autoButton.style.display = "";
        }
        else if (this.game.mode === GameMode.Create) {
            this.container.style.display = "block";
            this.editButton.style.display = "none";
            this.photoButton.style.display = "none";
            this.shareButton.style.display = "none";
            this.likeButton.style.display = "none";
            if (this.game.DEBUG_MODE) {
                this.boostButton.style.display = "";
            }
            else {
                this.boostButton.style.display = "none";
            }
        }
        else if (this.game.mode === GameMode.Challenge) {
            this.container.style.display = "block";
            this.loadInputShown = false;
            this.editButton.style.display = this.game.DEBUG_MODE ? "" : "none";
            this.photoButton.style.display = "none";
            this.shareButton.style.display = "none";
            this.likeButton.style.display = "none";
            if (this.game.challenge.mode === ChallengeMode.Parkour && this.game.challenge.state < 100) {
                this.boostButton.style.display = "";
            }
            else {
                this.boostButton.style.display = "none";
            }
            this.autoButton.style.display = "";
        }
        else if (this.game.mode === GameMode.Demo) {
            if (this.game.devMode.activated && !this.game.devMode.isVideoModeSquareOn()) {
                this.devModeToolbar.style.display = "block";
            }
            this.container.style.display = "block";
            this.loadInputShown = false;
            this.editButton.style.display = "";
            this.photoButton.style.display = "";
            this.shareButton.style.display = "";
            this.likeButton.style.display = this.game.OFFLINE_MODE ? "none" : "";
            if (this.game.likeManager.isCurrentMachineLiked()) {
                this.likeButton.querySelector("#toolbar-liked-icon").style.display = "block";
                this.likeButton.querySelector("#toolbar-not-liked-icon").style.display = "none";
            }
            else {
                this.likeButton.querySelector("#toolbar-liked-icon").style.display = "none";
                this.likeButton.querySelector("#toolbar-not-liked-icon").style.display = "block";
            }
            document.querySelector("#toolbar-likes-count").innerText = this.game.machine.dbLikes.toFixed(0);
            this.boostButton.style.display = "none";
            this.autoButton.style.display = "";
        }
        else if (this.game.mode === GameMode.BBPuzzle) {
            this.container.style.display = "none";
        }
    }
    resize() {
        this.updateButtonsVisibility();
        let margin = Math.min(window.innerWidth, window.innerHeight) * 0.02;
        let containerWidth = this.container.clientWidth;
        this.container.style.left = (this.game.canvasLeft + (this.game.canvas.getBoundingClientRect().width - containerWidth) * 0.5) + "px";
        requestAnimationFrame(() => {
            this.timeFactorInputContainer.style.display = this.timeFactorInputShown ? "" : "none";
            let rectButton = this.timeFactorButton.getBoundingClientRect();
            let rectContainer = this.timeFactorInputContainer.getBoundingClientRect();
            this.timeFactorInputContainer.style.left = rectButton.left.toFixed(0) + "px";
            this.timeFactorInputContainer.style.top = (rectButton.top - rectContainer.height - margin).toFixed(0) + "px";
            this.soundInputContainer.style.display = this.soundInputShown ? "" : "none";
            rectButton = this.soundButton.getBoundingClientRect();
            rectContainer = this.soundInputContainer.getBoundingClientRect();
            this.soundInputContainer.style.left = rectButton.left.toFixed(0) + "px";
            this.soundInputContainer.style.top = (rectButton.top - rectContainer.height - margin).toFixed(0) + "px";
            this.editInputContainer.style.display = this.editInputShown ? "" : "none";
            rectButton = this.editButton.getBoundingClientRect();
            rectContainer = this.editInputContainer.getBoundingClientRect();
            this.editInputContainer.style.left = (rectButton.right - rectContainer.width).toFixed(0) + "px";
            this.editInputContainer.style.top = (rectButton.top - rectContainer.height - margin).toFixed(0) + "px";
            this.shareInputContainer.style.display = this.shareInputShown ? "" : "none";
            rectButton = this.shareButton.getBoundingClientRect();
            rectContainer = this.shareInputContainer.getBoundingClientRect();
            this.shareInputContainer.style.left = (rectButton.right - rectContainer.width).toFixed(0) + "px";
            this.shareInputContainer.style.top = (rectButton.top - rectContainer.height - margin).toFixed(0) + "px";
            let containerRect = this.container.getBoundingClientRect();
            this.reloadingContainer.style.left = containerRect.left.toFixed(0) + "px";
            this.reloadingContainer.style.bottom = (window.innerHeight - containerRect.top + margin).toFixed(0) + "px";
            let boostButtonRect = this.boostButton.getBoundingClientRect();
            this.boostButton.style.left = ((containerRect.left + containerRect.right) * 0.5 - boostButtonRect.width * 0.5).toFixed(0) + "px";
            this.boostButton.style.bottom = (window.innerHeight - containerRect.top + 2 * margin).toFixed(0) + "px";
        });
    }
    isPlayStopDisabled() {
        return this.playButton.classList.contains("inactive");
    }
    enablePlayStop() {
        this.playButton.classList.remove("inactive");
        this.stopButton.classList.remove("inactive");
    }
    disablePlayStop() {
        this.playButton.classList.add("inactive");
        this.stopButton.classList.add("inactive");
    }
}
class Topbar {
    constructor(game) {
        this.game = game;
        this._shown = true;
        this.camModeButtons = [];
        this._udpate = () => {
        };
    }
    initialize() {
        this.container = document.querySelector("#topbar");
        this.container.style.display = "block";
        this.container.addEventListener("pointerdown", StopPointerProgatation);
        this.container.addEventListener("pointermove", StopPointerProgatation);
        this.container.addEventListener("pointerup", StopPointerProgatationAndMonkeys);
        this.showHideButton = this.container.querySelector(".cam-mode");
        this.camModeButtons[CameraMode.None] = this.container.querySelector(".cam-mode-none");
        this.camModeButtons[CameraMode.Landscape] = this.container.querySelector(".cam-mode-landscape");
        this.camModeButtons[CameraMode.Ball] = this.container.querySelector(".cam-mode-ball");
        this.camModeButtons[CameraMode.Selected] = this.container.querySelector(".cam-mode-selected");
        this.showHideButton.onclick = () => {
            this._shown = !this._shown;
            this.resize();
        };
        for (let i = CameraMode.None; i <= CameraMode.Selected; i++) {
            let mode = i;
            this.camModeButtons[mode].onclick = () => {
                /*if (mode === CameraMode.Landscape && this.game.movieMaker && this.game.movieMaker.viewpoints.length > 0) {
                    this.game.setCameraMode(CameraMode.Movie);
                }
                else */ if (mode === CameraMode.Ball) {
                    this.game.setCameraMode(CameraMode.FirstPersonBall);
                }
                else {
                    this.game.setCameraMode(mode);
                }
                this.resize();
            };
        }
        this.game.scene.onBeforeRenderObservable.add(this._udpate);
    }
    dispose() {
        this.game.scene.onBeforeRenderObservable.removeCallback(this._udpate);
        if (this.container) {
            this.container.removeEventListener("pointerdown", StopPointerProgatation);
            this.container.removeEventListener("pointermove", StopPointerProgatation);
            this.container.removeEventListener("pointerup", StopPointerProgatationAndMonkeys);
        }
    }
    updateButtonsVisibility() {
        for (let i = CameraMode.None; i < this.camModeButtons.length; i++) {
            this.camModeButtons[i].style.display = this._shown ? "" : "none";
        }
        if (this.game.mode === GameMode.Create || this.game.mode === GameMode.Demo) {
            this.container.style.display = "block";
            if (this._shown) {
                if (this.game.mode === GameMode.Create) {
                    this.camModeButtons[CameraMode.Selected].style.display = "";
                }
                else {
                    this.camModeButtons[CameraMode.Selected].style.display = "none";
                }
            }
        }
        else {
            this.container.style.display = "none";
        }
    }
    resize() {
        this.updateButtonsVisibility();
        if (this.game.screenRatio >= 1) {
            let toolbar = document.getElementById("machine-editor-toolbar");
            if (toolbar.style.display != "none" && (IsMobile != 1)) {
                let w = toolbar.getBoundingClientRect().width;
                this.container.style.left = w.toFixed(0) + "px";
                this.container.style.width = "calc(var(--button-m-size) * 1.2)";
            }
            else {
                if (IsMobile === 1) {
                    this.container.style.left = "70px";
                }
                else {
                    this.container.style.left = "0";
                }
                this.container.style.width = "calc(var(--button-m-size) * 1.2)";
            }
        }
        else {
            this.container.style.left = "0px";
            this.container.style.width = "";
        }
        this.camModeButtons.forEach(button => {
            button.classList.remove("active");
        });
        let mode = this.game.cameraMode === CameraMode.FirstPersonBall ? CameraMode.Ball : this.game.cameraMode;
        if (this.camModeButtons[mode]) {
            this.camModeButtons[mode].classList.add("active");
        }
    }
}
class UserMachinesPage {
    constructor(game) {
        this.game = game;
        this.camModeButtons = [];
        this.votes = {
            up: [],
            down: []
        };
        this.page = document.getElementById("user-machines-page");
        if (HasLocalStorage) {
            let savedVotes = localStorage.getItem("user-machines-votes");
            if (savedVotes) {
                this.votes = JSON.parse(savedVotes);
            }
        }
    }
    get shown() {
        return this.page.shown;
    }
    show(duration) {
        this.page.show(duration);
    }
    hide(duration) {
        if (this.page) {
            this.page.hide(duration);
        }
    }
    async redraw() {
        let container = this.page.querySelector(".container");
        let e = document.createElement("div");
        e.classList.add("line");
        container.appendChild(e);
        let label = document.createElement("span");
        label.classList.add("label");
        label.innerText = "移轉";
        e.appendChild(label);
        let open = document.createElement("button");
        open.classList.add("square-button", "next");
        e.appendChild(open);
        open.onclick = () => {
            this.migrate(0, 2000);
        };
        let dataResponse = await fetch(LOCAL_SHARE_SERVICE_PATH + "machines_list");
        if (dataResponse) {
            try {
                let data = await dataResponse.text();
                if (data) {
                    let ids = data.split(",");
                    console.log("User Machines fetched. " + ids.length + " machines found.");
                    for (let i = 0; i < ids.length; i++) {
                        let id = ids[i];
                        if (id) {
                            let e = document.createElement("div");
                            e.classList.add("line");
                            container.appendChild(e);
                            let label = document.createElement("span");
                            label.classList.add("label");
                            label.innerText = id;
                            e.appendChild(label);
                            let anchor = document.createElement("a");
                            anchor.setAttribute("href", location.protocol + "//" + location.host + "/#machine?id=" + id);
                            anchor.setAttribute("target", "_blank");
                            e.appendChild(anchor);
                            let open = document.createElement("button");
                            open.classList.add("square-button", "next");
                            anchor.appendChild(open);
                            let up = document.createElement("button");
                            up.classList.add("square-button", "plus");
                            if (this.votes.up.indexOf(id) === -1) {
                                up.classList.add("inactive");
                            }
                            up.onclick = () => {
                                let index = this.votes.up.indexOf(id);
                                if (index === -1) {
                                    this.votes.up.push(id);
                                    up.classList.remove("inactive");
                                }
                                else {
                                    this.votes.up.splice(index, 1);
                                    up.classList.add("inactive");
                                }
                                localStorage.setItem("user-machines-votes", JSON.stringify(this.votes));
                            };
                            e.appendChild(up);
                            let down = document.createElement("button");
                            down.classList.add("square-button", "minus");
                            if (this.votes.down.indexOf(id) === -1) {
                                down.classList.add("inactive");
                            }
                            down.onclick = () => {
                                let index = this.votes.down.indexOf(id);
                                if (index === -1) {
                                    this.votes.down.push(id);
                                    down.classList.remove("inactive");
                                }
                                else {
                                    this.votes.down.splice(index, 1);
                                    down.classList.add("inactive");
                                }
                                localStorage.setItem("user-machines-votes", JSON.stringify(this.votes));
                            };
                            e.appendChild(down);
                        }
                    }
                }
            }
            catch (error) {
                location.hash = "#home";
                return;
            }
        }
    }
    async migrate(start = 0, count = 10) {
        try {
            let dataResponse = await fetch(LOCAL_SHARE_SERVICE_PATH + "machines_list");
            let data = await dataResponse.text();
            console.log(data);
            if (data) {
                let ids = data.split(",");
                console.log("User Machines fetched. " + ids.length + " machines found.");
                for (let i = start; i < start + count; i++) {
                    if (ids[i]) {
                        await this.migrateStep(ids[i]);
                    }
                }
            }
        }
        catch (e) {
            console.error(e);
        }
    }
    async migrateStep(legacyMachineId) {
        try {
            let legacyDataResponse = await fetch(LOCAL_SHARE_SERVICE_PATH + "machine_old/" + legacyMachineId);
            let legacyDataText = await legacyDataResponse.text();
            let legacyDataTextSplit = legacyDataText.split("{");
            let creationTime = parseInt(legacyDataTextSplit[0]);
            legacyDataTextSplit.splice(0, 1);
            legacyDataText = "{" + legacyDataTextSplit.reduce((t1, t2) => { return t1 + "{" + t2; });
            let legacyData = JSON.parse(legacyDataText);
            legacyData.creation = creationTime.toFixed(0);
            if (legacyData) {
                if (legacyData.v < 12) {
                    let data = {
                        version: legacyData.v,
                        title: legacyData.n,
                        author: legacyData.a,
                        content: legacyData.d,
                        creation: legacyData.creation
                    };
                    let dataString = JSON.stringify(data);
                    const response = await fetch(SHARE_SERVICE_PATH + "publish_machine", {
                        method: "POST",
                        mode: "cors",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: dataString,
                    });
                    const machineId = await response.text();
                    console.log("Legacy machineId=" + legacyMachineId + " published as " + machineId);
                }
            }
        }
        catch (e) {
            console.error(e);
        }
    }
}
class UIElement extends BABYLON.Mesh {
    constructor(name) {
        super(name);
        this.w = 1;
        this.h = 1;
        this.posShow = new BABYLON.Vector3(0, 0, 0);
        this.posHide = new BABYLON.Vector3(-2, -2, -2);
        this.animatePosition = Mummu.AnimationFactory.EmptyVector3Callback;
        this.isClickable = false;
        this.animatePosition = Mummu.AnimationFactory.CreateVector3(this, this, "position");
    }
    triggerPosUpdate() {
        if (this.shown) {
            this.position.copyFrom(this.posShow);
        }
        else {
            this.position.copyFrom(this.posHide);
        }
    }
    get size() {
        return this.scaling.x;
    }
    set size(s) {
        this.scaling.copyFromFloats(s, s, s);
    }
    async show(duration = 0.5) {
        if (duration === 0) {
            this.position.copyFrom(this.posShow);
        }
        else {
            await this.animatePosition(this.posShow, duration, Nabu.Easing.easeOutCubic);
        }
        this.shown = true;
    }
    async hide(duration = 0.5) {
        this.shown = false;
        if (duration === 0) {
            this.position.copyFrom(this.posHide);
        }
        else {
            await this.animatePosition(this.posHide, duration, Nabu.Easing.easeInCubic);
        }
    }
    async onPointerDown() { }
    async onPointerUp() { }
}
/// <reference path="UIElement.ts"/>
class Button extends UIElement {
    constructor(game, diameter = 0.1) {
        super("button");
        this.game = game;
        this.diameter = diameter;
        this.isToggle = false;
        this.animateButtonHeight = Mummu.AnimationFactory.EmptyNumberCallback;
        this.animateWait = Mummu.AnimationFactory.EmptyVoidCallback;
        this.animateHightlightSize = Mummu.AnimationFactory.EmptyNumberCallback;
        this.stopHint = false;
        this.base = new BABYLON.Mesh("base");
        Core.MainMaterials.SetAsOutlinedMesh(this.base);
        this.base.parent = this;
        this.button = new BABYLON.Mesh("button");
        Core.MainMaterials.SetAsOutlinedMesh(this.button);
        this.button.parent = this;
        this.highlightMesh = BABYLON.MeshBuilder.CreateCylinder("highlight", { diameter: 1 * this.diameter, height: 0.05 * this.diameter, tessellation: 32 });
        this.highlightMesh.position.y = -0.025 * this.diameter;
        this.highlightMesh.parent = this;
        this.highlightSize = 0.8;
        this.highlightMesh.isVisible = false;
        this.animateButtonHeight = Mummu.AnimationFactory.CreateNumber(this.button, this.button.position, "y");
        this.animateHightlightSize = Mummu.AnimationFactory.CreateNumber(this.highlightMesh, this, "highlightSize", undefined, undefined, Nabu.Easing.easeInOutSine);
        this.animateWait = Mummu.AnimationFactory.CreateWait(this);
    }
    get highlightSize() {
        return this.highlightMesh.scaling.x;
    }
    set highlightSize(s) {
        this.highlightMesh.scaling.copyFromFloats(s, 1, s);
    }
    async instantiate() {
        let data = await this.game.vertexDataLoader.get("./datas/meshes/button.babylon");
        Mummu.ScaleVertexDataInPlace(Mummu.CloneVertexData(data[0]), this.diameter).applyToMesh(this.base);
        Mummu.ScaleVertexDataInPlace(Mummu.CloneVertexData(data[1]), this.diameter).applyToMesh(this.button);
        this.clickSound = new BABYLON.Sound("echo", "./datas/sounds/clic.wav", undefined, undefined, { volume: 0.25, autoplay: false });
    }
    async onPointerDown() {
        console.log("ptdown");
        this.clickSound.play();
        if (this.isToggle) {
            this.value = !this.value;
        }
        if (this.onPointerDownCallback) {
            this.onPointerDownCallback();
        }
        if (this.isToggle) {
            if (this.value) {
                await this.animateButtonHeight(-0.14 * this.diameter, 0.1);
            }
            else {
                await this.animateButtonHeight(0 * this.diameter, 0.3);
            }
        }
        else {
            await this.animateButtonHeight(-0.14 * this.diameter, 0.1);
            if (!this.onPointerUpCallback) {
                await this.animateButtonHeight(0 * this.diameter, 0.3);
            }
        }
    }
    async onPointerUp() {
        console.log("ptup");
        if (this.onPointerUpCallback) {
            this.onPointerUpCallback();
        }
        if (this.isToggle) {
        }
        else {
            await this.animateButtonHeight(0, 0.3);
        }
    }
    reset() {
        if (this.isToggle) {
            this.value = false;
            this.animateButtonHeight(0, 0.3);
        }
    }
    async hint() {
        this.stopHint = false;
        this.highlightMesh.isVisible = true;
        if (!this.stopHint) {
            await this.animateHightlightSize(1.2, 0.25, Nabu.Easing.easeOutCubic);
        }
        await this.animateHightlightSize(0.8, 0.25, Nabu.Easing.easeInCubic);
        if (!this.stopHint) {
            await this.animateHightlightSize(1.2, 0.25, Nabu.Easing.easeOutCubic);
        }
        await this.animateHightlightSize(0.8, 0.25, Nabu.Easing.easeInCubic);
        await this.animateWait(0.8);
        this.highlightMesh.isVisible = false;
    }
}
class ButtonWheelButtonMesh extends UIElement {
    constructor(wheel) {
        super("buttonwheel-buttonmesh");
        this.wheel = wheel;
        this._currentHorizontalIndex = -1;
        this._currentVerticalIndex = -1;
        this.animateRotationY = Mummu.AnimationFactory.EmptyNumberCallback;
        this.onClickCallback = () => { };
        this.animateRotationY = Mummu.AnimationFactory.CreateNumber(this, this.rotation, "x", () => { this.rotation.y = this.rotation.x * 0.5; });
    }
    setCurrentHorizontalIndex(v) {
        if (v != this._currentHorizontalIndex) {
            this._currentHorizontalIndex = v;
            if (this.wheel.onShownButtonIndexChange) {
                this.wheel.onShownButtonIndexChange(this, this._currentHorizontalIndex, this._currentVerticalIndex);
            }
        }
    }
    setCurrentVerticalIndex(v) {
        if (v != this._currentVerticalIndex) {
            this._currentVerticalIndex = v;
            if (this.wheel.onShownButtonIndexChange) {
                this.wheel.onShownButtonIndexChange(this, this._currentHorizontalIndex, this._currentVerticalIndex);
            }
        }
    }
    async onClick() {
        if (this.onClickCallback) {
            console.log("bwheelclick");
            this.wheel.clickSound.play();
            await this.animateRotationY(Math.PI / 8, 0.1, Nabu.Easing.easeOutSine);
            this.animateRotationY(0, 0.5, Nabu.Easing.easeInOutSine);
            this.onClickCallback();
        }
    }
}
class ButtonWheel extends UIElement {
    constructor(game, w, h, totalButtonsCount, verticalCount = 3) {
        super("textbox");
        this.game = game;
        this.totalButtonsCount = totalButtonsCount;
        this.verticalCount = verticalCount;
        this.text = "";
        this.backgroundColor = "#000000";
        this.textColor = "#ffffff";
        this.fontSize = 40;
        this.verticalOffset = 0;
        this.noFrame = false;
        this.animatePosition = Mummu.AnimationFactory.EmptyVector3Callback;
        this.animateRotationY = Mummu.AnimationFactory.EmptyNumberCallback;
        this.buttonS = 1;
        this.displayedCount = 3;
        this.halfDisplayedCount = 1;
        this.horizontalCount = 17;
        this.fScroll = 0;
        this.fScrollMin = 0;
        this.fScrollMax = 0;
        this.currentScroll = 0;
        this.prevFScroll = undefined;
        this.nextFScroll = undefined;
        this.update = () => {
            if (this.currentScroll != 0) {
                this.fScroll += this.currentScroll;
                this.fScroll = Nabu.MinMax(this.fScroll, this.fScrollMin, this.fScrollMax);
            }
            else if (this.prevFScroll != undefined) {
                if (this.fScroll < this.prevFScroll) {
                    this.prevFScroll = undefined;
                }
                else {
                    this.prevFScroll = Nabu.MinMax(this.prevFScroll, this.fScrollMin, this.fScrollMax);
                    this.fScroll = this.fScroll * 0.97 + this.prevFScroll * 0.03;
                    if (Math.abs(this.fScroll - this.prevFScroll) < 1 / (this.horizontalCount * 3)) {
                        this.prevFScroll = undefined;
                    }
                }
            }
            else if (this.nextFScroll != undefined) {
                if (this.fScroll > this.nextFScroll) {
                    this.nextFScroll = undefined;
                }
                else {
                    this.nextFScroll = Nabu.MinMax(this.nextFScroll, this.fScrollMin, this.fScrollMax);
                    this.fScroll = this.fScroll * 0.97 + this.nextFScroll * 0.03;
                    if (Math.abs(this.fScroll - this.nextFScroll) < 1 / (this.horizontalCount * 3)) {
                        this.nextFScroll = undefined;
                    }
                }
            }
            else {
                let targetFScroll = Math.round(this.fScroll * this.horizontalCount) / this.horizontalCount;
                this.fScroll = this.fScroll * 0.97 + targetFScroll * 0.03;
            }
            let currentN = Math.round(this.horizontalCount * this.fScroll);
            let centerX = this.horizontalCount * this.fScroll * this.buttonS;
            for (let j = 0; j < this.verticalCount; j++) {
                for (let i = 0; i < this.displayedCount; i++) {
                    let buttonHorizontalIndex = currentN + i - this.halfDisplayedCount;
                    let buttonVerticalIndex = j;
                    let buttonMesh = this.shownButtons[i][j];
                    buttonMesh.position.x = (currentN - this.halfDisplayedCount + i) * this.buttonS - centerX;
                    buttonMesh.rotation.y = -buttonMesh.position.x * 0.5;
                    let halfViewWidth = this.displayedCount * this.buttonS * 0.5;
                    let tmpX = Math.abs(buttonMesh.position.x);
                    if (tmpX > halfViewWidth - (0.5 * this.buttonS)) {
                        buttonMesh.visibility = 1 - (tmpX - (halfViewWidth - (0.5 * this.buttonS))) / (0.5 * this.buttonS);
                    }
                    else {
                        buttonMesh.visibility = 1;
                    }
                    if (buttonHorizontalIndex < 0) {
                        buttonMesh.isVisible = false;
                    }
                    else if (buttonHorizontalIndex >= this.horizontalCount) {
                        buttonMesh.isVisible = false;
                    }
                    else {
                        buttonMesh.isVisible = true;
                        buttonMesh.setCurrentHorizontalIndex(buttonHorizontalIndex);
                        buttonMesh.setCurrentVerticalIndex(buttonVerticalIndex);
                    }
                }
            }
        };
        this.onShownButtonIndexChange = (buttonMesh, horizontalIndex, verticalIndex) => {
            if (buttonMesh.material instanceof BABYLON.StandardMaterial) {
                if (buttonMesh.material.diffuseTexture instanceof BABYLON.DynamicTexture) {
                    buttonMesh.isVisible = true;
                    let context = buttonMesh.material.diffuseTexture.getContext();
                    context.fillStyle = "white";
                    context.fillRect(0, 0, 256, 256);
                    context.font = "80px Arial";
                    context.fillStyle = "black";
                    context.fillText(horizontalIndex + " " + verticalIndex, 0, 200);
                    buttonMesh.material.diffuseTexture.update();
                }
            }
        };
        this.w = w;
        this.h = h;
        /*
        let debug = BABYLON.MeshBuilder.CreateBox("debug", { width: this.w, height: this.h, depth: 0.1 });
        debug.parent = this;
        debug.position.copyFromFloats(0, 0, 0.2);
        debug.visibility = 0.2;
        debug.layerMask = 0x10000000;
        */
        this.buttonS = this.h / (this.verticalCount + 1);
        this.horizontalCount = Math.ceil(totalButtonsCount / verticalCount);
        this.displayedCount = Math.floor(this.w / this.h * (this.verticalCount + 1));
        this.halfDisplayedCount = Math.floor(this.displayedCount * 0.5);
        this.fScrollMin = (this.halfDisplayedCount - 1) / this.horizontalCount;
        this.fScrollMax = 1 - this.halfDisplayedCount / this.horizontalCount;
        this.fScroll = this.fScrollMin;
        this.shownButtons = [];
        for (let i = 0; i < this.displayedCount; i++) {
            this.shownButtons[i] = [];
            for (let j = 0; j < this.verticalCount; j++) {
                let buttonMesh = new ButtonWheelButtonMesh(this);
                buttonMesh.scaling.copyFromFloats(this.buttonS * 0.9, this.buttonS * 0.9, this.buttonS * 0.9);
                buttonMesh.layerMask = 0x10000000;
                buttonMesh.parent = this;
                this.shownButtons[i][j] = buttonMesh;
                buttonMesh.position.y = (h - h / (this.verticalCount + 1)) * (0.5 - j / this.verticalCount);
                let material = new BABYLON.StandardMaterial("test");
                material.emissiveColor.copyFromFloats(0.2, 0.2, 0.2);
                material.specularColor.copyFromFloats(0, 0, 0);
                let texture = new BABYLON.DynamicTexture("texture", { width: 256, height: 256 });
                material.diffuseTexture = texture;
                buttonMesh.material = material;
            }
        }
        this.prevButton = new Button(this.game);
        this.prevButton.rotation.x = -Math.PI / 2 * 0.6;
        this.prevButton.size = this.buttonS * 0.7;
        this.prevButton.parent = this;
        this.prevButton.posShow.copyFromFloats(-0.3, -h * 0.5 + this.buttonS * 0.5, 0);
        this.prevButton.instantiate();
        this.prevButton.show(0);
        this.prevButton.onPointerDownCallback = () => {
            this.currentScroll = -0.0015;
            if (this.prevFScroll != undefined) {
                this.prevFScroll = this.prevFScroll - 1 / this.horizontalCount;
            }
            else {
                this.prevFScroll = this.fScroll - 1 / this.horizontalCount;
            }
        };
        this.prevButton.onPointerUpCallback = () => {
            this.currentScroll = 0;
        };
        this.nextButton = new Button(this.game);
        this.nextButton.rotation.x = -Math.PI / 2 * 0.7;
        this.nextButton.size = this.buttonS * 0.7;
        this.nextButton.parent = this;
        this.nextButton.posShow.copyFromFloats(0.3, -h * 0.5 + this.buttonS * 0.5, 0);
        this.nextButton.instantiate();
        this.nextButton.show(0);
        this.nextButton.onPointerDownCallback = () => {
            this.currentScroll = 0.0015;
            if (this.nextFScroll != undefined) {
                this.nextFScroll = this.nextFScroll + 1 / this.horizontalCount;
            }
            else {
                this.nextFScroll = this.fScroll + 1 / this.horizontalCount;
            }
        };
        this.nextButton.onPointerUpCallback = () => {
            this.currentScroll = 0;
        };
        this.game.scene.onBeforeRenderObservable.add(this.update);
        this.animatePosition = Mummu.AnimationFactory.CreateVector3(this, this, "position");
        this.animateRotationY = Mummu.AnimationFactory.CreateNumber(this, this.rotation, "x", () => { this.rotation.y = this.rotation.x * 0.5; });
    }
    triggerAll() {
        let currentN = Math.round(this.horizontalCount * this.fScroll);
        for (let j = 0; j < this.verticalCount; j++) {
            for (let i = 0; i < this.displayedCount; i++) {
                let buttonHorizontalIndex = currentN + i - this.halfDisplayedCount;
                let buttonVerticalIndex = j;
                let buttonMesh = this.shownButtons[i][j];
                if (buttonHorizontalIndex < 0) {
                    buttonMesh.isVisible = false;
                }
                else if (buttonHorizontalIndex >= this.horizontalCount) {
                    buttonMesh.isVisible = false;
                }
                else {
                    buttonMesh.isVisible = true;
                    buttonMesh.setCurrentHorizontalIndex(buttonHorizontalIndex);
                    buttonMesh.setCurrentVerticalIndex(buttonVerticalIndex);
                    if (this.onShownButtonIndexChange) {
                        this.onShownButtonIndexChange(buttonMesh, buttonHorizontalIndex, buttonVerticalIndex);
                    }
                }
            }
        }
    }
    async instantiate() {
        let vertexData = await this.game.vertexDataLoader.getAtIndex("datas/meshes/button-wheel.babylon");
        for (let i = 0; i < this.displayedCount; i++) {
            for (let j = 0; j < this.verticalCount; j++) {
                vertexData.applyToMesh(this.shownButtons[i][j]);
            }
        }
        let prevMaterial = new BABYLON.StandardMaterial("material");
        prevMaterial.diffuseTexture = new BABYLON.Texture("./datas/icons/prev.png");
        prevMaterial.diffuseTexture.hasAlpha = true;
        prevMaterial.diffuseTexture.wrapU = 0;
        prevMaterial.diffuseTexture.wrapV = 0;
        prevMaterial.specularColor.copyFromFloats(0.1, 0.1, 0.1);
        this.prevButton.button.material = prevMaterial;
        let nextMaterial = new BABYLON.StandardMaterial("material");
        nextMaterial.diffuseTexture = new BABYLON.Texture("./datas/icons/next.png");
        nextMaterial.diffuseTexture.hasAlpha = true;
        nextMaterial.diffuseTexture.wrapU = 0;
        nextMaterial.diffuseTexture.wrapV = 0;
        nextMaterial.specularColor.copyFromFloats(0.1, 0.1, 0.1);
        this.nextButton.button.material = nextMaterial;
        this.clickSound = new BABYLON.Sound("echo", "./datas/sounds/clic.wav", undefined, undefined, { volume: 0.25, autoplay: false });
    }
}
