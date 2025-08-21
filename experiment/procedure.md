### Procedure

This experiment simulates the multiplication of two matrices using a parallel algorithm based on the Message Passing Interface (MPI). The simulation allows you to control various parameters to observe their impact on the performance of the parallel computation.

#### Controls

The simulation provides the following controls:

*   **Number of Processes:** You can select the number of MPI processes to be used in the computation. The available options are 2, 4, 6, and 8.
*   **Matrix Size:** You can choose the size of the matrices to be multiplied. The available options are 4x4, 6x6, and 8x8.
*   **Matrix Values:** You can either let the system generate random values for the matrices or manually edit the values of the matrix cells.
*   **Animation Speed:** This slider allows you to control the speed of the simulation's animation, making it easier to observe the different phases of the algorithm.
*   **Execution Mode:**
    *   **Automatic:** The simulation runs automatically from start to finish.
    *   **Step-by-Step:** You can manually step through the different phases of the algorithm.

#### Steps to perform the experiment:

1.  **System Configuration:**
    *   Select the desired number of processes from the "Number of Processes" dropdown.
    *   Choose the matrix size from the "Matrix Size" dropdown.
    *   Select the matrix value mode ("Random Values" or "Manual Edit"). If you choose "Manual Edit", you can click on the matrix cells to change their values.
    *   Adjust the animation speed using the "Animation Speed" slider.
    *   Select the execution mode ("Automatic" or "Step-by-Step").

2.  **Simulation Control:**
    *   Click the "Start Simulation" button to begin the experiment.
    *   If you are in "Step-by-Step" mode, the "Next Step" button will be enabled, allowing you to proceed through the algorithm's phases.
    *   The "Randomize Matrices" button (available in "Manual Edit" mode) will fill the matrices with new random values.

3.  **Observation:**
    *   The "Process Grid" visualizes the MPI processes and their states.
    *   The "Matrix Display" shows the matrices A, B, and the resulting matrix C. The colors indicate how the rows of matrix A are distributed among the processes.
    *   The "Simulation Logs" provide a textual description of the events occurring during the simulation.
    *   The "Performance Comparison" chart (which appears after the simulation) compares the performance of the parallel algorithm with a sequential one.
    *   The "MPI Code Download" section allows you to download the C code implementation of the parallel matrix multiplication algorithm.