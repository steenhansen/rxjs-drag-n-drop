<!DOCTYPE html>
<html lang="en">
<head>
  	<meta charset="UTF-8">
	<title>RxJs Drag</title>
  	<script src="https://unpkg.com/@reactivex/rxjs@5.5.11/dist/global/Rx.js"></script>
</head>
<body>
	<style>
		.drag-receive{ position: absolute; z-index:1; }
		.drag-from   { position: absolute; z-index:2; }
		.drag-element{ position: absolute; user-select: none; }
		div{
			padding:10px;
		}
		.big-box{
			height: 200px;
			width: 200px;	
		}
	    .from-area{
			background-color: #ccccff;
	 	}
	 	.element-box{
	 		background-color: #000000; 
			cursor: move; 
	 		color: #ffffff; 
	 	}
		.receive-area{
			background-color: #ffcccc;
	 	}
	 	#dropped-elements{
	 		font-weight: bold;
	 	}
	 	.animal-spacer{
	 		height:25px;
	 	}
	 	#dropped-animals{
	 		height:200px;
	 	}
	</style>

	<div class="drag-from from-area big-box">
		Drag From Here
			<div class="animal-spacer">&nbsp;</div>
    	<div id="cat" class="drag-element element-box">Cat</div>
			<div class="animal-spacer">&nbsp;</div>
    	<div id="dog"  class="drag-element element-box">Dog</div>
			<div class="animal-spacer">&nbsp;</div>
    	<div id="sheep"  class="drag-element element-box">Sheep</div>
    </div>

	<div id="dropped-animals">&nbsp;</div>

    Dropped Animals : <span id='dropped-elements'>none<!--dropped animals--></span> 

	<div class="drag-receive receive-area big-box">
		Drop Here
	</div>

<script>
const cursor_offset = 8;

const canDragElement = mousedown_event => mousedown_event.target.className.includes('drag-element');

const getBeneathDragElem = mouseup_event => {
	const dragged_element_id = mouseup_event.target.id;
    document.getElementById(dragged_element_id).hidden = true;
    const under_drag_elem = document.elementFromPoint(mouseup_event.clientX, mouseup_event.clientY);
    document.getElementById(dragged_element_id).hidden = false;
    return under_drag_elem;
}

const canReceiveDrag = mouseup_event  => {
	if (mouseup_event.target.className.includes('drag-receive')){  // mouse-up just beside a drag-element on the drag-receive
		return true;
	}
	if (mouseup_event.target.id==''){
		return false;            // mouse-up outside the drag-receive
	}
 	const under_drag_elem =getBeneathDragElem(mouseup_event);
	const can_drag = under_drag_elem.className.includes('drag-receive');  // mouse-up on a drag-element
	return can_drag;
}

// [ {sheep: false}, {dog: true}, {cat: true} ]
const dragHistoryList = function (accum_hash, mouseup_event__dropped_id){   
	const [mouseup_event, dropped_id] = mouseup_event__dropped_id;
    const is_chosen = canReceiveDrag(mouseup_event);     
	accum_hash[dropped_id] = is_chosen;
	return accum_hash;
}

const getChosenIds = function (dragged_list){
	let dragged_array = Object.entries(dragged_list);                            // [ {sheep: false}, {dog: true}, {cat: true} ]
  	let chosen_ids = dragged_array.filter( ([the_id, is_chosen]) => is_chosen);  // [ {dog: true}, {cat: true} ]
  	let only_chosen_ids = chosen_ids.map( ([the_id, is_chosen]) => the_id);      // [ dog, cat ]
 	return only_chosen_ids;
}

const mouseDown$ = Rx.Observable.fromEvent(document, 'mousedown')
                     .filter(canDragElement)
                     .map( down_event=> {return {target:down_event.target,
                      	                         x_offset:down_event.offsetX + cursor_offset,
                      	                         y_offset:down_event.offsetY + cursor_offset}; } );

const mouseMove$ = Rx.Observable.fromEvent(document, 'mousemove');
const mouseUp$ = Rx.Observable.fromEvent(document, 'mouseup');
const mouseDrag$ = mouseDown$.switchMap(() => mouseMove$.takeUntil(mouseUp$)); 
const elementDragging$ = mouseDrag$.withLatestFrom(mouseDown$); // [drag_event,    mousedown_event]
const elementDropped$ = mouseUp$.withLatestFrom(mouseDown$);    // [mouseup_event, mousedown_event]

elementDragging$.subscribe( 
	([drag_event, mousedown_event]) => {
        const x_pos = drag_event.clientX - mousedown_event.x_offset;
        const y_pos = drag_event.clientY - mousedown_event.y_offset;
		const dragging_elem = mousedown_event.target;
	  	dragging_elem.style.left = x_pos + 'px';
		dragging_elem.style.top = y_pos  + 'px'; } );
 
// figure out which elements are in drop container
const chosenElements$ = elementDropped$
  	.map(([mouseup_event, mousedown_event]) => [mouseup_event, mousedown_event.target.id])
 	.scan((accum_hash, mouseup_event__dropped_id) => dragHistoryList(accum_hash, mouseup_event__dropped_id) , [])
 	.map(getChosenIds);

chosenElements$.subscribe(
	current_chosen=> {document.getElementById('dropped-elements').innerHTML = current_chosen; } );

/* remember where the dragged items started, so can return them when not chosen
[ { the_id: "cat", the_top: "46px", the_left: "10px" }     // original cat location
  { the_id: "dog", the_top: "100px", the_left: "10px" }    // original dog location
  { the_id: "cat", the_top: "282px", the_left: "157px" } ]                                    */
const recordOrginalPositions$ = mouseDown$
    .map(mousedown_event => [mousedown_event.target.id, window.getComputedStyle(mousedown_event.target)])
 	.map(([drag_id, the_style]) => {return {the_id:drag_id, the_top:the_style.top, the_left:the_style.left}})	
 	.scan((start_drags, initial_down) => {start_drags.push(initial_down); return start_drags;} , []);

/* get first item which must be the original location 
[ { the_id: "cat", the_top: "46px", the_left: "10px" }     // original cat location
  { the_id: "cat", the_top: "282px", the_left: "157px" } ]                                     */
const backToOrgPos$ = Rx.Observable.zip(elementDropped$, recordOrginalPositions$)
    .filter(([[mouseup_event, _mousedown_event], _original_positions]) => !canReceiveDrag(mouseup_event))
	.map(([[_mouseup_event, mousedown_event], original_positions]) => {return [mousedown_event.target.id, original_positions]})
 	.map(([drag_id, original_positions]) => {return original_positions.filter( (a_start_pos)=> a_start_pos.the_id == drag_id)})
 	.map(filtered_original_positions => {return filtered_original_positions[0]; } );

backToOrgPos$.subscribe(
 	dragged_elem => { 
 		const {the_id, the_top, the_left} = dragged_elem;
 		document.getElementById(the_id).style.top = the_top;
 		document.getElementById(the_id).style.left = the_left; } );
</script>
</body>
</html>
