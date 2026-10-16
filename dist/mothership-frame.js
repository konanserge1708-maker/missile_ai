import * as THREE from 'three';

// The whale's forward axis is -X. Gain altitude while pitching so its long nose
// remains above the globe, then align the forward cannon with its ground target.
export function aimMothership(center,quaternion,target,weight){
 const blend=THREE.MathUtils.clamp(weight,0,1),position=center.clone().addScaledVector(center.clone().normalize(),2.1*blend);
 const forward=new THREE.Vector3(-1,0,0).applyQuaternion(quaternion),direction=target.clone().sub(position).normalize();
 const aim=new THREE.Quaternion().setFromUnitVectors(forward,direction).multiply(quaternion);
 return {center:position,quaternion:quaternion.clone().slerp(aim,blend)};
}
