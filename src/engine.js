import './engine/vendor/mp4-muxer.min.js';
/* ============================================================
   JIZURA web — engine loader
   side-effect imports in the same order as build.py (sorted src/*.js,
   minus the old 12_ui.js editor). Everything lands on window.J.
   ============================================================ */

import './engine/01_util.js';
import './engine/02_fonts.js';
import './engine/02b_lang.js';
import './engine/03_text.js';
import './engine/04_styles.js';
import './engine/05_anim.js';
import './engine/05b_registry.js';
import './engine/06_layouts.js';
import './engine/07_decor.js';
import './engine/08_planner.js';
import './engine/08b_omakase.js';
import './engine/09_render.js';
import './engine/10_audio.js';
import './engine/11_export.js';
import './engine/11p_bgcamB.js';
import './engine/11p_decor.js';
import './engine/11p_decorB.js';
import './engine/11p_enter.js';
import './engine/11p_enterB.js';
import './engine/11p_exit.js';
import './engine/11p_exitB.js';
import './engine/11p_fxB.js';
import './engine/11p_horror1.js';
import './engine/11p_horror2.js';
import './engine/11p_horror3.js';
import './engine/11p_kinetic1.js';
import './engine/11p_kinetic2.js';
import './engine/11p_kinetic3.js';
import './engine/11p_layoutsA.js';
import './engine/11p_layoutsB.js';
import './engine/11p_layoutsC.js';
import './engine/11p_layoutsD.js';
import './engine/11p_looks.js';
import './engine/11p_styles.js';
import './engine/11p_treattrans.js';
import './engine/11p_typo1.js';
import './engine/11p_typo2.js';
import './engine/11p_typo3.js';
import './engine/11q_sets.js';

export const J = window.J;
