import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('--- RUNNING PHASE 3D-E: LEGACY PRODUCTION CLEANUP VERIFICATION ---');

const pagePath = path.join(process.cwd(), 'app', 'production-studio', 'page.tsx');
const reviewPath = path.join(process.cwd(), 'components', 'production-studio', 'ReviewPanel.tsx');

assert(fs.existsSync(pagePath), 'app/production-studio/page.tsx must exist');
assert(fs.existsSync(reviewPath), 'components/production-studio/ReviewPanel.tsx must exist');

const pageContent = fs.readFileSync(pagePath, 'utf8');
const reviewContent = fs.readFileSync(reviewPath, 'utf8');

console.log('Checking deleted legacy items from app/production-studio/page.tsx...');

// 1. selectedCarouselId / setSelectedCarouselId
assert(!pageContent.includes('selectedCarouselId'), 'selectedCarouselId must be removed from page.tsx');
assert(!pageContent.includes('setSelectedCarouselId'), 'setSelectedCarouselId must be removed from page.tsx');
console.log('✅ selectedCarouselId / setSelectedCarouselId removed');

// 2. ugcOutput / setUgcOutput / saveUgcOutput / studio_ugc_
assert(!pageContent.includes('ugcOutput'), 'ugcOutput must be removed from page.tsx');
assert(!pageContent.includes('setUgcOutput'), 'setUgcOutput must be removed from page.tsx');
assert(!pageContent.includes('saveUgcOutput'), 'saveUgcOutput must be removed from page.tsx');
assert(!pageContent.includes('studio_ugc_'), 'studio_ugc_ storage reference must be removed from page.tsx');
console.log('✅ ugcOutput / setUgcOutput / saveUgcOutput / studio_ugc_ removed');

// 3. getGoogleFlowVideoPack / GoogleFlowSceneItem / buildGoogleFlowPromptString / UgcPack
assert(!pageContent.includes('getGoogleFlowVideoPack'), 'getGoogleFlowVideoPack must be removed from page.tsx');
assert(!pageContent.includes('GoogleFlowSceneItem'), 'GoogleFlowSceneItem must be removed from page.tsx');
assert(!pageContent.includes('buildGoogleFlowPromptString'), 'buildGoogleFlowPromptString must be removed from page.tsx');
assert(!pageContent.includes('UgcPack'), 'UgcPack must be removed from page.tsx');
console.log('✅ getGoogleFlowVideoPack / GoogleFlowSceneItem / buildGoogleFlowPromptString removed');

// 4. flowCustomCreator / flowCustomSetting / flowCustomDialogues
assert(!pageContent.includes('flowCustomCreator'), 'flowCustomCreator must be removed from page.tsx');
assert(!pageContent.includes('flowCustomSetting'), 'flowCustomSetting must be removed from page.tsx');
assert(!pageContent.includes('flowCustomDialogues'), 'flowCustomDialogues must be removed from page.tsx');
console.log('✅ flowCustomCreator / flowCustomSetting / flowCustomDialogues removed');

// 5. handleProceedToProduction
assert(!pageContent.includes('handleProceedToProduction'), 'handleProceedToProduction must be removed from page.tsx');
assert(!reviewContent.includes('handleProceedToProduction'), 'handleProceedToProduction must be removed from ReviewPanel.tsx');
console.log('✅ handleProceedToProduction removed from page.tsx and ReviewPanel.tsx');

// 6. ReviewPanel legacy wording
assert(!reviewContent.includes('3 scene Google Flow'), 'ReviewPanel must not contain "3 scene Google Flow" wording');
console.log('✅ ReviewPanel legacy Google Flow wording removed');

// 7. UGCPanel import & filesystem check
assert(!pageContent.includes('UGCPanel'), 'UGCPanel import must be removed from page.tsx');
const ugcPanelPath = path.join(process.cwd(), 'components', 'production-studio', 'UGCPanel.tsx');
assert(!fs.existsSync(ugcPanelPath), 'Legacy components/production-studio/UGCPanel.tsx must be deleted from the filesystem');
console.log('✅ UGCPanel import removed and UGCPanel.tsx deleted from filesystem');

// 8. Canonical Preservation Check
console.log('Checking preservation of canonical production architecture...');
assert(pageContent.includes('carouselPlan'), 'carouselPlan must be preserved');
assert(pageContent.includes('carouselProductionGate'), 'carouselProductionGate must be preserved');
assert(pageContent.includes('carouselSlideCompletionState'), 'carouselSlideCompletionState must be preserved');
assert(pageContent.includes('videoProductionGate'), 'videoProductionGate must be preserved');
assert(pageContent.includes('videoSceneCompletionState'), 'videoSceneCompletionState must be preserved');
assert(pageContent.includes('handlePrepareCarouselProductionPackage'), 'handlePrepareCarouselProductionPackage must be preserved');
assert(pageContent.includes('handlePrepareVideoProductionPackage'), 'handlePrepareVideoProductionPackage must be preserved');
assert(pageContent.includes('prepareProductionPackage'), 'prepareProductionPackage must be preserved');
assert(pageContent.includes('saveProductionPackage'), 'saveProductionPackage must be preserved');
console.log('✅ Canonical production architecture fully preserved');

console.log('🎉 ALL LEGACY PRODUCTION CLEANUP CHECKS PASSED (100% OK)');
