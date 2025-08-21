### Theory

#### Matrix Multiplication

Matrix multiplication is a fundamental operation in linear algebra with wide applications in various fields such as computer graphics, physics, and machine learning. The product of two matrices, A and B, is a third matrix, C, where each element is the result of a dot product of a row from A and a column from B.

##### Definition

If A is an *m* x *n* matrix and B is an *n* x *p* matrix, their product AB is an *m* x *p* matrix. The element at row *i* and column *j* of the resulting matrix C is given by:

C(i,j) = Σ (from k=1 to n) A(i,k) * B(k,j)

For the multiplication to be defined, the number of columns in the first matrix (*n*) must be equal to the number of rows in the second matrix (*n*).

##### Properties

*   **Associativity:** (AB)C = A(BC)
*   **Distributivity:** A(B + C) = AB + AC
*   **Not Commutative:** In general, AB ≠ BA.

##### Computational Complexity

The naive algorithm for multiplying two *n* x *n* matrices requires *n^3* multiplications and *(n-1)n^2* additions. This results in a time complexity of O(*n*<sup>3</sup>). For large matrices, this can be computationally expensive.

#### Parallel Matrix Multiplication

To speed up matrix multiplication, we can use parallel algorithms. The basic idea is to divide the matrices into smaller blocks and distribute the computation among multiple processors.

##### Master-Worker Paradigm

A common approach for parallel matrix multiplication is the master-worker paradigm. In this model:

1.  **Master Process:** The master process is responsible for:
    *   Initializing the matrices A and B.
    *   Dividing matrix A into row blocks.
    *   Distributing the row blocks of A and the entire matrix B to the worker processes (a step often called "scatter").
    *   Gathering the computed results (rows of matrix C) from the worker processes.
    *   Assembling the final result matrix C.

2.  **Worker Processes:** Each worker process is responsible for:
    *   Receiving its assigned row block of A and the complete matrix B from the master.
    *   Performing the multiplication for its assigned rows to compute a part of the result matrix C.
    *   Sending its computed part of C back to the master process.

##### Message Passing Interface (MPI)

MPI (Message Passing Interface) is a standardized and portable message-passing system designed to function on a wide variety of parallel computing architectures. It provides a set of functions for sending and receiving messages between processes, which is essential for implementing parallel algorithms like matrix multiplication.

Key MPI functions used in this context include:

*   `MPI_Init`: Initializes the MPI environment.
*   `MPI_Comm_size`: Gets the total number of processes.
*   `MPI_Comm_rank`: Gets the rank (ID) of the current process.
*   `MPI_Scatter`: Distributes data from the master process to all other processes.
*   `MPI_Bcast`: Broadcasts data from one process to all other processes.
*   `MPI_Gatherv`: Gathers data from all processes to the master process.
*   `MPI_Finalize`: Terminates the MPI environment.

By using MPI, we can effectively parallelize the matrix multiplication process, leading to significant performance improvements, especially for large matrices. This experiment provides a visual simulation of this parallel algorithm, helping to understand the underlying concepts and their practical implementation.