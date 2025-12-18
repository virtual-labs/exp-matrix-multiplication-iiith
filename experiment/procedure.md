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

#### Detailed Algorithm Execution:

**What Each Process Does During Multiplication:**

**Phase 1 - Data Distribution (Scatter):**
- **Master Process (Rank 0):**
  - Initializes matrices A and B with random or user-defined values
  - Calculates how many rows each process should handle: `rows_per_process = ceiling(matrix_size / num_processes)`
  - Sends consecutive row blocks of matrix A to worker processes using MPI_Send
  - Broadcasts the complete matrix B to all processes using MPI_Bcast
  - Keeps its own assigned rows (typically rows 0 to rows_per_process-1)

- **Worker Processes (Rank 1, 2, 3, ...):**
  - Receive their assigned row block from the master using MPI_Recv
  - Receive the complete matrix B via broadcast
  - Prepare local storage for partial results

**Phase 2 - Parallel Computation:**
Each process (including master) performs **independent computation**:
```
for each assigned row i:
    for each column j in result matrix:
        C[i][j] = 0
        for each element k:
            C[i][j] += A[i][k] * B[k][j]  // Dot product computation
```

**Workload Distribution Example (12×12 matrix, 4 processes):**
- Process 0: Computes rows 0-2 (3 rows)
- Process 1: Computes rows 3-5 (3 rows)  
- Process 2: Computes rows 6-8 (3 rows)
- Process 3: Computes rows 9-11 (3 rows)

**Phase 3 - Result Collection (Gather):**
- **Worker Processes:** Send their computed row blocks back to master using MPI_Send
- **Master Process:** 
  - Collects partial results from all workers using MPI_Recv
  - Assembles the complete result matrix C by placing each worker's rows in correct positions
  - Displays final result and performance metrics

**Key Observations to Watch For:**
- **Color-coded rows** show which process is responsible for which rows
- **Process states** change from Idle → Computing → Sending/Receiving → Completed  
- **Matrix cells light up** as calculations complete, showing real-time progress
- **Communication patterns** are visible during scatter and gather phases
- **Load balancing** ensures each process gets roughly equal work