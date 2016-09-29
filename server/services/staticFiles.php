<?php
header('Content-type: application/json');

$arr = array(
    array(
    	'title'=>'edu1',
    	'file'=>"static/data/educational-technology.csv"
    	),
    // array(
    // 	'title'=>'edu2',
    // 	'file'=>"static/data/edu2.csv"
    // 	),
    // array(
    // 	'title'=>'edu3',
    // 	'file'=>"static/data/edu3.csv"
    // 	),
    array(
    	'title'=>'edu4',
    	'file'=>"static/data/edu4.csv"
    	),
    array(
    	'title'=>'edu5',
    	'file'=>"static/data/edu5.csv")
    );

echo json_encode($arr);

exit();
?>