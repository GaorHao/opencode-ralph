import { render, useKeyboard } from "@opentui/solid";
import { createSignal, onCleanup } from "solid-js";
import { Header } from "./components/header";
import { Log } from "./components/log";
import { Footer } from "./components/footer";
import { PausedOverlay } from "./components/paused";
import type { LoopState, LoopOptions, PersistedState, ToolEvent } from "./state";
import { colors } from "./components/colors";
