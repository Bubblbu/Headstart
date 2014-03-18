<?php

namespace headstart\calculation;

/**
 * Calculation using an R script for ordination and clustering
 *
 * @author pkraker
 */

use headstart\library;

require_once 'Calculation.php';

class RCalculation extends Calculation {
      
    public function performCalculationAndWriteOutputToFile() {
        $ini = $this->ini_array["calculation"];
        $output = $this->ini_array["output"];
        
        $base_dir = $this->ini_array["general"]["preprocessing_dir"];
        $binary = $ini["binary"];
        $script = $base_dir . $ini["script"];
        $wd = $base_dir . $this->ini_array["output"]["output_dir"] 
                . (($this->ini_array["general"]["year"])?($this->ini_array["general"]["year"]):(""));
        
        $path = '"' . $binary . '" ' .$script. ' "' . $wd . '" "'
                . $output["cooc"] . '" "' . $output["metadata"] . '" "' . $output["output_scaling_clustering"] .'"';
        
        library\Toolkit::info($path);
        exec($path); 
    }
}