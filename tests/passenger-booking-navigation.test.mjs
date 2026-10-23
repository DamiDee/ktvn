import test from "node:test";
import assert from "node:assert/strict";
import { bookingHome, clearBookingPlace, derivePassengerPhase, emptyDraft } from "../src/features/paid-rides/domain/phases.ts";
import { initialRideSession } from "../src/features/paid-rides/domain/ride-session.ts";
const pickup={id:"pickup",name:"Jabi",point:{lat:9.0721,lng:7.4246},source:"search"};
const destination={id:"destination",name:"Wuse",point:{lat:9.0647,lng:7.4728},source:"search"};
const quoted={...emptyDraft,step:"options",pickup,destination,optionId:"go"};
const ready={...initialRideSession,bootstrap:"ready"};

test("Back from the fare card reaches the first card even with a complete route",()=>{
  assert.equal(derivePassengerPhase(quoted,ready),"ROUTE_PREVIEW");
  const home=bookingHome(quoted);
  assert.equal(derivePassengerPhase(home,ready),"IDLE");
  assert.equal(home.optionId,null);
  assert.equal(home.pickup,pickup);assert.equal(home.destination,destination);
  // Closing/reopening location search must not resurrect the fare step.
  const search={...home,step:"search",field:"destination"};
  assert.equal(derivePassengerPhase(search,ready),"SELECTING_DESTINATION");
  assert.equal(derivePassengerPhase(bookingHome(search),ready),"IDLE");
});
for(const field of ["pickup","destination"]){
  test(`editing or clearing ${field} invalidates its coordinates and ride choice`,()=>{
    const edited=clearBookingPlace(quoted,field);
    assert.equal(edited[field],null);assert.equal(edited.optionId,null);
    const other=field==="pickup"?"destination":"pickup";
    assert.equal(edited[other],quoted[other]);
    assert.equal(derivePassengerPhase(edited,ready),field==="pickup"?"SELECTING_PICKUP":"SELECTING_DESTINATION");
    assert.equal(derivePassengerPhase({...edited,step:"options"},ready),"IDLE");
    assert.equal(quoted[field],field==="pickup"?pickup:destination);
  });
}
test("returning to booking never discards or overrides an active server ride",()=>{
  const active={...ready,ride:{id:"live",status:"IN_PROGRESS"}};
  assert.equal(derivePassengerPhase(bookingHome(quoted),active),"TRIP_ACTIVE");
  assert.equal(active.ride.id,"live");
});
